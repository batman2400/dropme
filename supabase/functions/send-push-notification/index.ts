// ─── dropme. Push Notification Edge Function ──────────────────
// Sends Web Push notifications to drivers when a ride request is created.
//
// Trigger: Called via Database Webhook when a row is INSERTed into ride_requests
//          OR called directly from the frontend as a fallback.
//
// Flow:
// 1. Receive the new ride_request payload
// 2. Look up the driver of that ride
// 3. Look up the driver's push subscription(s)
// 4. Send Web Push notification to each subscription
// ─────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

// ─── Web Push Crypto Helpers ──────────────────────────────────
// The Web Push protocol requires VAPID JWT signing + payload encryption.
// We implement this using the Web Crypto API (available in Deno).

/**
 * Convert a URL-safe base64 string to a Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Convert a Uint8Array to URL-safe base64 string
 */
function uint8ArrayToUrlBase64(uint8Array: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Create a VAPID JWT token for authenticating with the push service
 */
async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string
): Promise<string> {
  // JWT Header
  const header = { typ: "JWT", alg: "ES256" };
  const headerB64 = uint8ArrayToUrlBase64(
    new TextEncoder().encode(JSON.stringify(header))
  );

  // JWT Payload (expires in 12 hours)
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  };
  const payloadB64 = uint8ArrayToUrlBase64(
    new TextEncoder().encode(JSON.stringify(payload))
  );

  // Import the private key for signing
  const privateKeyBytes = urlBase64ToUint8Array(privateKeyBase64);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    convertRawPrivateKeyToPkcs8(privateKeyBytes),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Sign the JWT
  const signatureInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    signatureInput
  );

  // Convert DER signature to raw r+s format for JWT
  const signatureArray = derToRaw(new Uint8Array(signatureBuffer));
  const signatureB64 = uint8ArrayToUrlBase64(signatureArray);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Convert a 32-byte raw private key to PKCS8 format
 */
function convertRawPrivateKeyToPkcs8(rawKey: Uint8Array): ArrayBuffer {
  // PKCS8 header for P-256 EC key
  const pkcs8Header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  // After the raw key, we need a suffix
  const pkcs8Suffix = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00,
  ]);

  // We'll just use the basic format without the public key part
  const simpleHeader = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);

  const result = new Uint8Array(simpleHeader.length + rawKey.length);
  result.set(simpleHeader);
  result.set(rawKey, simpleHeader.length);
  return result.buffer;
}

/**
 * Convert DER-encoded ECDSA signature to raw r||s format
 */
function derToRaw(der: Uint8Array): Uint8Array {
  // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
  const raw = new Uint8Array(64);
  let offset = 2; // Skip 0x30 and total length

  // Read r
  offset++; // Skip 0x02
  const rLen = der[offset++];
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen > 32 ? 0 : 32 - rLen;
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;

  // Read s
  offset++; // Skip 0x02
  const sLen = der[offset++];
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen > 32 ? 32 : 32 + (32 - sLen);
  raw.set(der.slice(sStart, offset + sLen), sDest);

  return raw;
}

/**
 * Encrypt the push notification payload using the Web Push encryption scheme (aes128gcm)
 */
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const payloadBytes = new TextEncoder().encode(payload);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Import subscriber's public key
  const subscriberPublicKeyBytes = urlBase64ToUint8Array(p256dhKey);
  const subscriberPublicKey = await crypto.subtle.importKey(
    "raw",
    subscriberPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberPublicKey },
    localKeyPair.privateKey,
    256
  );

  // Export local public key
  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  // Auth secret
  const authSecretBytes = urlBase64ToUint8Array(authSecret);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive encryption key using HKDF
  // Step 1: IKM = HKDF-Extract(auth_secret, shared_secret)
  const ikmKey = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(sharedSecret),
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );

  // info for IKM derivation
  const authInfo = new TextEncoder().encode("WebPush: info\0");
  const keyInfoInput = new Uint8Array(
    authInfo.length + subscriberPublicKeyBytes.length + localPublicKeyRaw.length
  );
  keyInfoInput.set(authInfo);
  keyInfoInput.set(subscriberPublicKeyBytes, authInfo.length);
  keyInfoInput.set(localPublicKeyRaw, authInfo.length + subscriberPublicKeyBytes.length);

  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: authSecretBytes, info: keyInfoInput },
      ikmKey,
      256
    )
  );

  // Step 2: Derive content encryption key
  const ikmCryptoKey = await crypto.subtle.importKey(
    "raw",
    ikm,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );

  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const contentEncryptionKeyBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt, info: cekInfo },
    ikmCryptoKey,
    128
  );

  // Step 3: Derive nonce
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt, info: nonceInfo },
    ikmCryptoKey,
    96
  );

  // Encrypt the payload
  const cek = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKeyBits,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Add padding delimiter (0x02 for the last record)
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // Record padding delimiter

  const encryptedPayload = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: new Uint8Array(nonceBits) },
      cek,
      paddedPayload
    )
  );

  // Build aes128gcm content: salt(16) + rs(4) + idlen(1) + keyid(65) + encrypted
  const rs = 4096;
  const rsBytes = new Uint8Array(4);
  new DataView(rsBytes.buffer).setUint32(0, rs);

  const header = new Uint8Array(
    16 + 4 + 1 + localPublicKeyRaw.length
  );
  header.set(salt, 0);
  header.set(rsBytes, 16);
  header[20] = localPublicKeyRaw.length;
  header.set(localPublicKeyRaw, 21);

  const encrypted = new Uint8Array(header.length + encryptedPayload.length);
  encrypted.set(header);
  encrypted.set(encryptedPayload, header.length);

  return { encrypted, salt, localPublicKey: localPublicKeyRaw };
}

/**
 * Send a Web Push notification
 */
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const payloadString = JSON.stringify(payload);

    // Encrypt the payload
    const { encrypted } = await encryptPayload(
      payloadString,
      subscription.p256dh,
      subscription.auth
    );

    // Create VAPID JWT
    const endpoint = new URL(subscription.endpoint);
    const audience = `${endpoint.protocol}//${endpoint.host}`;
    const jwt = await createVapidJwt(audience, vapidSubject, vapidPrivateKey);

    // Send the push
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Content-Length": encrypted.length.toString(),
        TTL: "86400", // 24 hours
        Urgency: "high",
        Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      },
      body: encrypted,
    });

    if (response.status === 201) {
      return { success: true, status: 201 };
    } else if (response.status === 410 || response.status === 404) {
      // Subscription has expired or is no longer valid
      return { success: false, status: response.status, error: "subscription_expired" };
    } else {
      const body = await response.text();
      return { success: false, status: response.status, error: body };
    }
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Main Handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS headers for browser requests
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get secrets from environment
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@dropme.app";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("VAPID keys not configured");
    }

    // Parse the request body
    // Could be a Database Webhook payload or a direct API call
    const body = await req.json();

    // Database Webhook format: { type: "INSERT", table: "ride_requests", record: {...} }
    // Direct API call format: { ride_request_id: "..." }
    let rideRequestId: string;
    let rideId: string;
    let passengerId: string;
    let seatsRequested: number;
    let pickupAddress: string;
    let dropoffAddress: string;
    let fare: number;

    if (body.type === "INSERT" && body.record) {
      // Database Webhook payload
      const record = body.record;
      rideRequestId = record.id;
      rideId = record.ride_id;
      passengerId = record.passenger_id;
      seatsRequested = record.seats_requested;
      pickupAddress = record.pickup_address || "Pickup";
      dropoffAddress = record.dropoff_address || "Dropoff";
      fare = record.fare;
    } else if (body.ride_request_id) {
      // Direct API call — fetch the ride request data
      rideRequestId = body.ride_request_id;

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const { data: rideRequest, error } = await supabaseAdmin
        .from("ride_requests")
        .select("*")
        .eq("id", rideRequestId)
        .single();

      if (error || !rideRequest) {
        throw new Error(`Ride request not found: ${rideRequestId}`);
      }

      rideId = rideRequest.ride_id;
      passengerId = rideRequest.passenger_id;
      seatsRequested = rideRequest.seats_requested;
      pickupAddress = rideRequest.pickup_address || "Pickup";
      dropoffAddress = rideRequest.dropoff_address || "Dropoff";
      fare = rideRequest.fare;
    } else {
      throw new Error("Invalid request body — expected webhook payload or { ride_request_id }");
    }

    // Create Supabase admin client (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get the driver_id from the ride
    const { data: ride, error: rideError } = await supabaseAdmin
      .from("rides")
      .select("driver_id")
      .eq("id", rideId)
      .single();

    if (rideError || !ride) {
      throw new Error(`Ride not found: ${rideId}`);
    }

    // 2. Get the passenger name
    const { data: passenger } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", passengerId)
      .single();

    const passengerName = passenger?.full_name || "Someone";

    // 3. Get driver's push subscriptions (they might have multiple devices)
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", ride.driver_id);

    if (subError) {
      throw new Error(`Failed to fetch push subscriptions: ${subError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No push subscriptions found for this driver",
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
          status: 200,
        }
      );
    }

    // 4. Build the notification payload
    const notificationPayload = {
      title: "🚗 New Ride Request!",
      body: `${passengerName} wants ${seatsRequested} seat${seatsRequested > 1 ? "s" : ""} — Rs. ${fare}\n${pickupAddress.split(",")[0]} → ${dropoffAddress.split(",")[0]}`,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: `ride-request-${rideRequestId}`,
      rideId: rideId,
      url: `/active-ride/${rideId}`,
    };

    // 5. Send push notification to all subscriptions
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const result = await sendWebPush(
          sub,
          notificationPayload,
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        );

        // Clean up expired subscriptions
        if (!result.success && result.error === "subscription_expired") {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("user_id", ride.driver_id)
            .eq("endpoint", sub.endpoint);
        }

        return result;
      })
    );

    const successCount = results.filter((r) => r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: subscriptions.length,
        results,
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 200,
      }
    );
  } catch (err) {
    console.error("Push notification error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 400,
      }
    );
  }
});
