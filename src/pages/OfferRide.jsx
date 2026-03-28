import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Autocomplete } from '@react-google-maps/api';
import TopNavBar from '../components/TopNavBar';
import BottomNavBar from '../components/BottomNavBar';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleMaps } from '../contexts/GoogleMapsProvider';

// ─── Pricing Config ───────────────────────────────────────
// These match the master architecture's Distance-Only Flat Rate
const PRICING = {
  bike: { base: 50, perKm: 70, seats: 1 },
  tuk:  { base: 50, perKm: 80, seats: 3 },
  car:  { base: 80, perKm: 100, seats: 4 },
};

export default function OfferRide() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { isLoaded } = useGoogleMaps();

  // ─── Driver profile data ──────────────────────────────────
  const [vehicleType, setVehicleType] = useState('');   // 'bike', 'tuk', or 'car'
  const [availableSeats, setAvailableSeats] = useState(0);
  const [profileReady, setProfileReady] = useState(false);

  // ─── Location inputs ─────────────────────────────────────
  const autocompletePickup = useRef(null);
  const autocompleteDropoff = useRef(null);
  const [pickup, setPickup] = useState(null);   // { address, lat, lng }
  const [dropoff, setDropoff] = useState(null);  // { address, lat, lng }
  const [departureTime, setDepartureTime] = useState('');

  // ─── Route & pricing ─────────────────────────────────────
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [routePolyline, setRoutePolyline] = useState('');
  const [calculatedFare, setCalculatedFare] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState('');

  // ─── 1. Fetch driver profile on mount ─────────────────────
  // We need: vehicle_type, vehicle_plate, phone_number, is_verified
  // In our new schema, profiles.id = session.user.id (auth.uid())
  useEffect(() => {
    const fetchDriverProfile = async () => {
      if (!session?.user) return;

      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('vehicle_type, vehicle_plate, phone_number, is_verified')
        .eq('id', session.user.id)
        .single();

      if (fetchErr) {
        setError('Could not load your profile. Please try again.');
        return;
      }

      if (!data.vehicle_type) {
        setError('Please set your vehicle type in your Profile before posting a ride.');
        return;
      }
      if (!data.vehicle_plate) {
        setError('Please add your license plate in your Profile before posting a ride.');
        return;
      }
      if (!data.phone_number) {
        setError('Please add your WhatsApp number in your Profile before posting a ride.');
        return;
      }

      // Auto-set vehicle type and seats from profile
      const vType = data.vehicle_type.toLowerCase(); // ensure lowercase
      setVehicleType(vType);
      setAvailableSeats(PRICING[vType]?.seats || 1);
      setProfileReady(true);
    };

    fetchDriverProfile();
  }, [session]);

  // ─── 2. Calculate route when both locations are set ────────
  // We use the Directions API (not DistanceMatrix) because we
  // also need the encoded polyline for the rides table.
  useEffect(() => {
    if (!pickup || !dropoff || !isLoaded || !vehicleType) {
      setCalculatedFare(0);
      setDistanceKm(0);
      setDurationMin(0);
      setRoutePolyline('');
      return;
    }

    calculateRoute();
  }, [pickup, dropoff, vehicleType, isLoaded]);

  const calculateRoute = async () => {
    setIsCalculating(true);
    setError('');

    try {
      const directionsService = new window.google.maps.DirectionsService();

      const result = await directionsService.route({
        origin: { lat: pickup.lat, lng: pickup.lng },
        destination: { lat: dropoff.lat, lng: dropoff.lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      });

      // Extract distance, duration, and polyline from the response
      const leg = result.routes[0].legs[0];
      const km = leg.distance.value / 1000;       // meters → km
      const mins = leg.duration.value / 60;         // seconds → minutes
      const polyline = result.routes[0].overview_polyline;

      setDistanceKm(km);
      setDurationMin(mins);
      setRoutePolyline(polyline);

      // Apply pricing formula: base + (perKm × km)
      const pricing = PRICING[vehicleType];
      if (pricing) {
        const fare = Math.round(pricing.base + pricing.perKm * km);
        setCalculatedFare(fare);
      }
    } catch (err) {
      console.error('Directions API error:', err);
      // Append the actual API error message/code so the developer knows why it failed
      const apiStatus = err.code || err.message || 'Unknown Error';
      setError(`Could not calculate route (${apiStatus}). Please check your locations.`);
    } finally {
      setIsCalculating(false);
    }
  };

  // ─── 3. Handle place selection from Autocomplete ──────────
  const onPickupPlaceChanged = () => {
    if (autocompletePickup.current !== null) {
      const place = autocompletePickup.current.getPlace();
      if (place.geometry) {
        setPickup({
          address: place.formatted_address || place.name,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    }
  };

  const onDropoffPlaceChanged = () => {
    if (autocompleteDropoff.current !== null) {
      const place = autocompleteDropoff.current.getPlace();
      if (place.geometry) {
        setDropoff({
          address: place.formatted_address || place.name,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    }
  };

  // ─── 4. Publish ride to Supabase ──────────────────────────
  const handlePublish = async () => {
    if (!pickup || !dropoff || !departureTime) {
      setError('Please fill in all details before publishing.');
      return;
    }
    if (!calculatedFare || calculatedFare === 0) {
      setError('Please wait for the fare to calculate before publishing.');
      return;
    }

    setError('');
    setIsPublishing(true);

    // Build departure datetime
    const [hours, minutes] = departureTime.split(':');
    const departureDate = new Date();
    departureDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

    // If departure time has already passed today, set it to tomorrow
    if (departureDate < new Date()) {
      departureDate.setDate(departureDate.getDate() + 1);
    }

    const { data: insertedRide, error: insertError } = await supabase
      .from('rides')
      .insert({
        driver_id: session.user.id,       // profiles.id = auth.uid()
        vehicle_type: vehicleType,
        available_seats: availableSeats,
        start_lat: pickup.lat,
        start_lng: pickup.lng,
        end_lat: dropoff.lat,
        end_lng: dropoff.lng,
        start_address: pickup.address,
        end_address: dropoff.address,
        route_polyline: routePolyline,
        departure_time: departureDate.toISOString(),
        price_per_seat: calculatedFare,
      })
      .select('id')    // ← Ask Supabase to return the new row's ID
      .single();

    setIsPublishing(false);

    if (insertError) {
      console.error('Insert error:', insertError);
      setError(insertError.message);
    } else {
      // Redirect to the driver's live request page
      navigate(`/active-ride/${insertedRide.id}`);
    }
  };

  // ─── Loading state ────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">
          progress_activity
        </span>
      </div>
    );
  }

  // ─── Vehicle type display helper ──────────────────────────
  const vehicleLabel = vehicleType === 'tuk' ? 'Tuk-Tuk' : vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1);
  const vehicleIcon = vehicleType === 'bike' ? 'two_wheeler' : vehicleType === 'tuk' ? 'electric_rickshaw' : 'directions_car';

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-28">
      <TopNavBar showAvatar showNotification />

      <main className="px-6 mt-4 content-grid">
        {/* Header */}
        <section className="mb-8 animate-fade-up">
          <span className="font-label text-[10px] font-semibold uppercase tracking-wider text-primary mb-2 block">
            Driver Console
          </span>
          <h2 className="font-headline text-3xl font-extrabold tracking-tight leading-none mb-4">
            Share your journey,
            <br />
            <span className="text-primary-container">share the cost.</span>
          </h2>
        </section>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-error/10 text-error rounded-xl text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
          </div>
        )}

        {/* ── Form ── */}
        <section className="space-y-6">
          {/* Location inputs with connecting dashed line */}
          <div className="bg-surface-container-low rounded-xl p-6 relative overflow-hidden">
            <div className="absolute left-6 top-[3.75rem] bottom-[3.75rem] w-px border-l-2 border-dashed border-outline-variant/30"></div>
            <div className="space-y-8">
              {/* Starting Point */}
              <div className="flex gap-4 items-start relative z-10">
                <div className="mt-1 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
                  <span className="material-symbols-outlined text-primary text-sm">my_location</span>
                </div>
                <div className="flex-1 w-full relative">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                    Pick-up Location
                  </label>
                  <Autocomplete
                    onLoad={(autocomplete) => (autocompletePickup.current = autocomplete)}
                    onPlaceChanged={onPickupPlaceChanged}
                    options={{
                      componentRestrictions: { country: 'lk' },
                      fields: ['formatted_address', 'geometry', 'name'],
                    }}
                  >
                    <input
                      className="w-full bg-surface-container-lowest border-none rounded-lg py-3 px-4 focus:ring-2 focus:ring-primary text-body text-sm placeholder:text-outline shadow-sm"
                      placeholder="Where are you starting from?"
                      type="text"
                    />
                  </Autocomplete>
                </div>
              </div>
              {/* End Point */}
              <div className="flex gap-4 items-start relative z-10">
                <div className="mt-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-sm shrink-0">
                  <span className="material-symbols-outlined text-white text-sm">location_on</span>
                </div>
                <div className="flex-1 w-full relative">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                    Destination
                  </label>
                  <Autocomplete
                    onLoad={(autocomplete) => (autocompleteDropoff.current = autocomplete)}
                    onPlaceChanged={onDropoffPlaceChanged}
                    options={{
                      componentRestrictions: { country: 'lk' },
                      fields: ['formatted_address', 'geometry', 'name'],
                    }}
                  >
                    <input
                      className="w-full bg-surface-container-lowest border-none rounded-lg py-3 px-4 focus:ring-2 focus:ring-primary text-body text-sm placeholder:text-outline shadow-sm"
                      placeholder="Where are you heading?"
                      type="text"
                    />
                  </Autocomplete>
                </div>
              </div>
            </div>
          </div>

          {/* Time + Vehicle Info row */}
          <div className="grid grid-cols-2 gap-3 animate-fade-up stagger-3">
            {/* Departure Time */}
            <div className="bg-surface-container-low rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-lg">schedule</span>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Time
                </label>
              </div>
              <input
                className="w-full bg-surface-container-lowest border-none rounded-lg py-2 px-3 text-body text-sm font-semibold focus:ring-primary shadow-sm"
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
              />
            </div>
            {/* Vehicle + Seats (auto-set from profile, read-only) */}
            <div className="bg-surface-container-low rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-lg">{vehicleIcon}</span>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Vehicle
                </label>
              </div>
              <div className="bg-surface-container-lowest rounded-lg py-2 px-3 text-sm font-semibold">
                {profileReady ? (
                  <span>{vehicleLabel} · {availableSeats} seat{availableSeats > 1 ? 's' : ''}</span>
                ) : (
                  <span className="text-outline">Loading...</span>
                )}
              </div>
            </div>
          </div>

          {/* Route Preview Card (Dynamic Pricing) */}
          <div className="bg-surface-container-high rounded-2xl p-4 flex gap-4 overflow-hidden min-h-[130px] relative animate-fade-up stagger-4">
            <div className="flex-1 py-1 z-10">
              <p className="font-headline font-bold text-lg mb-1">Estimated Earnings</p>
              <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
                {distanceKm > 0
                  ? `${distanceKm.toFixed(1)} km · ${Math.round(durationMin)} min drive`
                  : 'Enter route to see estimated earnings.'}
              </p>
              <div className="inline-flex items-center gap-2 bg-primary px-3 py-1.5 rounded-full transition-all">
                {isCalculating ? (
                  <span className="material-symbols-outlined animate-spin text-white/60 text-sm">progress_activity</span>
                ) : (
                  <>
                    <span className="text-white font-headline font-bold text-sm">
                      Rs. {calculatedFare > 0 ? calculatedFare : '---'}
                    </span>
                    <span className="text-white/60 text-[10px] font-bold">PER SEAT</span>
                  </>
                )}
              </div>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-primary-fixed overflow-hidden z-0">
              <div className="w-full h-full flex items-center justify-center opacity-20">
                <span className="material-symbols-outlined text-7xl text-primary">route</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-surface-container-high"></div>
            </div>
          </div>
        </section>

        {/* Publish Button */}
        <section className="mt-8">
          <button
            onClick={handlePublish}
            disabled={isPublishing || !pickup || !dropoff || !departureTime || !profileReady || calculatedFare === 0}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white py-4 sm:py-5 rounded-full font-headline font-extrabold text-lg tracking-tight shadow-lg shadow-primary/20 btn-press disabled:opacity-50 animate-pulse-glow"
          >
            {isPublishing ? (
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
            ) : (
              'Publish Route'
            )}
          </button>
          <p className="text-center text-[10px] text-on-surface-variant mt-4 font-medium uppercase tracking-[0.1em]">
            By publishing, you agree to the{' '}
            <span className="text-primary border-b border-primary/20">pooler pledge</span>
          </p>
        </section>
      </main>

      <BottomNavBar activeTab="home" />
    </div>
  );
}
