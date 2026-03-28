import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Autocomplete } from '@react-google-maps/api';
import TopNavBar from '../components/TopNavBar';
import BottomNavBar from '../components/BottomNavBar';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleMaps } from '../contexts/GoogleMapsProvider';
import { haversineDistance } from '../utils/haversine';

// ─── Pricing Config (same as OfferRide) ─────────────────────
const PRICING = {
  bike: { base: 50, perKm: 70 },
  tuk:  { base: 50, perKm: 80 },
  car:  { base: 80, perKm: 100 },
};

// ─── Matching Config ────────────────────────────────────────
const MAX_DETOUR_MINUTES = 10;     // Max acceptable detour for the driver
const PROXIMITY_FILTER_KM = 20;    // Haversine pre-filter radius in km

export default function FindRide() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { isLoaded } = useGoogleMaps();

  // ─── Search inputs ────────────────────────────────────────
  const autocompletePickup = useRef(null);
  const autocompleteDropoff = useRef(null);
  const [pickup, setPickup] = useState(null);    // { address, lat, lng }
  const [dropoff, setDropoff] = useState(null);   // { address, lat, lng }
  const [seatsNeeded, setSeatsNeeded] = useState(1);

  // ─── State ────────────────────────────────────────────────
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState('');
  const [error, setError] = useState('');

  // ─── Place selection handlers ─────────────────────────────
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

  // ─── THE SEARCH: Detour Time Algorithm ────────────────────
  const handleSearch = async () => {
    if (!pickup || !dropoff) {
      setError('Please enter both pickup and drop-off locations.');
      return;
    }

    setError('');
    setIsSearching(true);
    setSearchProgress('Fetching available rides...');

    try {
      // ── Step 1: Fetch all active rides with driver info ────
      const { data: rides, error: fetchErr } = await supabase
        .from('rides')
        .select(`
          id, driver_id, vehicle_type, available_seats,
          start_lat, start_lng, end_lat, end_lng,
          start_address, end_address, route_polyline,
          departure_time, price_per_seat, status,
          driver:profiles!rides_driver_id_fkey (
            full_name, avatar_url, rating_avg, vehicle_plate
          )
        `)
        .eq('status', 'active')
        .gte('available_seats', seatsNeeded);

      if (fetchErr) throw fetchErr;

      if (!rides || rides.length === 0) {
        setIsSearching(false);
        navigate('/ride-matches', {
          state: {
            matches: [],
            pickup,
            dropoff,
            seatsNeeded,
          },
        });
        return;
      }

      // ── Step 2: Haversine pre-filter ──────────────────────
      // Only keep rides where the driver passes "close enough"
      // to both the passenger's pickup AND dropoff.
      setSearchProgress(`Filtering ${rides.length} rides by proximity...`);

      const nearbyRides = rides.filter((ride) => {
        let isPickupNearby = false;
        let isDropoffNearby = false;

        // Use Google Maps Geometry library to decode the polyline and check proximity
        if (ride.route_polyline && window.google.maps.geometry) {
          try {
            const decodedPath = window.google.maps.geometry.encoding.decodePath(ride.route_polyline);
            for (let i = 0; i < decodedPath.length; i++) {
              const pt = decodedPath[i];
              if (!isPickupNearby) {
                const distPickup = haversineDistance(pickup.lat, pickup.lng, pt.lat(), pt.lng());
                if (distPickup <= PROXIMITY_FILTER_KM) isPickupNearby = true;
              }
              if (!isDropoffNearby) {
                const distDropoff = haversineDistance(dropoff.lat, dropoff.lng, pt.lat(), pt.lng());
                if (distDropoff <= PROXIMITY_FILTER_KM) isDropoffNearby = true;
              }
              if (isPickupNearby && isDropoffNearby) break;
            }
          } catch (e) {
            console.warn('Polyline decode failed:', e);
          }
        }

        // Fallback bounding box heuristic for large paths (padding ~20km = ~0.2 degrees)
        if (!isPickupNearby || !isDropoffNearby) {
          const padding = PROXIMITY_FILTER_KM / 111;
          const minLat = Math.min(ride.start_lat, ride.end_lat) - padding;
          const maxLat = Math.max(ride.start_lat, ride.end_lat) + padding;
          const minLng = Math.min(ride.start_lng, ride.end_lng) - padding;
          const maxLng = Math.max(ride.start_lng, ride.end_lng) + padding;

          const pickupInBox = pickup.lat >= minLat && pickup.lat <= maxLat && pickup.lng >= minLng && pickup.lng <= maxLng;
          const dropoffInBox = dropoff.lat >= minLat && dropoff.lat <= maxLat && dropoff.lng >= minLng && dropoff.lng <= maxLng;
          
          isPickupNearby = isPickupNearby || pickupInBox;
          isDropoffNearby = isDropoffNearby || dropoffInBox;
        }

        return isPickupNearby && isDropoffNearby;
      });

      if (nearbyRides.length === 0) {
        setIsSearching(false);
        navigate('/ride-matches', {
          state: { matches: [], pickup, dropoff, seatsNeeded },
        });
        return;
      }

      // ── Step 3: Detour Time calculation via Directions API ─
      setSearchProgress(`Calculating detours for ${nearbyRides.length} ride${nearbyRides.length > 1 ? 's' : ''}...`);
      const directionsService = new window.google.maps.DirectionsService();
      const matches = [];

      for (const ride of nearbyRides) {
        try {
          // 3a. Get the ORIGINAL route duration (driver only)
          const originalResult = await directionsService.route({
            origin: { lat: ride.start_lat, lng: ride.start_lng },
            destination: { lat: ride.end_lat, lng: ride.end_lng },
            travelMode: window.google.maps.TravelMode.DRIVING,
          });
          const originalDurationSec = originalResult.routes[0].legs[0].duration.value;

          // 3b. Get the NEW route duration (with passenger pickup/dropoff)
          const detourResult = await directionsService.route({
            origin: { lat: ride.start_lat, lng: ride.start_lng },
            destination: { lat: ride.end_lat, lng: ride.end_lng },
            waypoints: [
              { location: { lat: pickup.lat, lng: pickup.lng }, stopover: true },
              { location: { lat: dropoff.lat, lng: dropoff.lng }, stopover: true },
            ],
            optimizeWaypointOrder: false, // Keep pickup before dropoff
            travelMode: window.google.maps.TravelMode.DRIVING,
          });

          // Sum all legs of the detour route
          const newDurationSec = detourResult.routes[0].legs.reduce(
            (sum, leg) => sum + leg.duration.value, 0
          );

          // 3c. Calculate the detour time
          const detourMinutes = (newDurationSec - originalDurationSec) / 60;

          // 3d. Is it a match? (≤ 10 minutes detour)
          if (detourMinutes <= MAX_DETOUR_MINUTES) {
            // Calculate passenger's fare based on their specific distance
            // (pickup → dropoff leg distance)
            const passengerLeg = detourResult.routes[0].legs[1]; // Pickup → Dropoff leg
            const passengerDistKm = passengerLeg.distance.value / 1000;

            const vehicleType = ride.vehicle_type ? ride.vehicle_type.toLowerCase() : 'car';
            const pricing = PRICING[vehicleType] || PRICING.car;
            const passengerFare = Math.round(pricing.base + pricing.perKm * passengerDistKm);

            matches.push({
              ...ride,
              detourMinutes: Math.round(detourMinutes),
              passengerDistanceKm: passengerDistKm,
              passengerFare,
              originalDurationMin: Math.round(originalDurationSec / 60),
              newDurationMin: Math.round(newDurationSec / 60),
            });
          }
        } catch (dirErr) {
          // Skip this ride if Directions API fails for it
          console.warn(`Directions API failed for ride ${ride.id}:`, dirErr);
        }
      }

      // Sort matches: lowest detour time first (best match)
      matches.sort((a, b) => a.detourMinutes - b.detourMinutes);

      // ── Step 4: Navigate to results page ──────────────────
      navigate('/ride-matches', {
        state: {
          matches,
          pickup,
          dropoff,
          seatsNeeded,
        },
      });
    } catch (err) {
      console.error('Search error:', err);
      setError('Something went wrong during the search. Please try again.');
    } finally {
      setIsSearching(false);
      setSearchProgress('');
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

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-28">
      <TopNavBar showAvatar showNotification />

      <main className="content-grid px-6 pt-8">
        <section className="mb-10 animate-fade-up">
          <div className="mb-8">
            <h2 className="font-headline font-extrabold text-3xl sm:text-4xl text-on-surface leading-tight tracking-tight">
              Where are you <br />
              <span className="text-primary">heading today?</span>
            </h2>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-error/10 text-error rounded-xl text-sm font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 animate-fade-up stagger-2">
            {/* Location Inputs */}
            <div className="bg-surface-container-low rounded-2xl p-5 sm:p-6 space-y-6">
              <div className="relative flex items-start gap-4">
                <div className="flex flex-col items-center pt-2">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    radio_button_checked
                  </span>
                  <div className="w-0.5 h-12 bg-outline-variant/30 my-1"></div>
                  <span
                    className="material-symbols-outlined text-error"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    location_on
                  </span>
                </div>
                <div className="flex-1 space-y-4">
                  <div className="space-y-1 relative">
                    <label className="font-label text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60 ml-1">
                      Pickup Location
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
                        className="w-full bg-surface-container-lowest ghost-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-on-surface-variant/40"
                        placeholder="Enter starting point"
                        type="text"
                      />
                    </Autocomplete>
                  </div>
                  <div className="space-y-1 relative">
                    <label className="font-label text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60 ml-1">
                      Drop-off Location
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
                        className="w-full bg-surface-container-lowest ghost-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-on-surface-variant/40"
                        placeholder="Enter destination"
                        type="text"
                      />
                    </Autocomplete>
                  </div>
                </div>
              </div>
            </div>

            {/* Seats Needed + Search */}
            <div className="space-y-4 animate-fade-up stagger-3">
              <div className="bg-surface-container-low rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="font-label text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60 ml-1">
                      Seats Needed
                    </label>
                    <div className="flex items-center justify-between bg-surface-container-lowest ghost-border rounded-xl px-4 py-3">
                      <span className="font-medium">{seatsNeeded} Passenger{seatsNeeded > 1 && 's'}</span>
                      <div className="flex gap-4">
                        <button
                          onClick={() => setSeatsNeeded(Math.max(1, seatsNeeded - 1))}
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-surface-container-high text-primary active:scale-90 transition-transform"
                        >
                          <span className="material-symbols-outlined text-sm">remove</span>
                        </button>
                        <button
                          onClick={() => setSeatsNeeded(Math.min(4, seatsNeeded + 1))}
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-primary text-white active:scale-90 transition-transform"
                        >
                          <span className="material-symbols-outlined text-sm">add</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Search button */}
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !pickup || !dropoff}
                    className="w-full py-4 bg-gradient-to-r from-primary to-primary-container text-white font-headline font-bold rounded-full shadow-lg shadow-primary/20 btn-press disabled:opacity-50 flex justify-center items-center gap-2 animate-pulse-glow"
                  >
                    {isSearching ? (
                      <>
                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        <span className="text-sm">{searchProgress}</span>
                      </>
                    ) : (
                      'Search Routes'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <BottomNavBar activeTab="home" />
    </div>
  );
}
