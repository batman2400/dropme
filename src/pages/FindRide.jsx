import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Autocomplete } from '@react-google-maps/api';
import TopNavBar from '../components/TopNavBar';
import BottomNavBar from '../components/BottomNavBar';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleMaps } from '../contexts/GoogleMapsProvider';

export default function FindRide() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { isLoaded } = useGoogleMaps();

  // Search details
  const autocompletePickup = useRef(null);
  const autocompleteDropoff = useRef(null);
  
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [departureTime, setDepartureTime] = useState('');
  const [seatsNeeded, setSeatsNeeded] = useState(1);
  
  // Pricing/Distance
  const [distanceKm, setDistanceKm] = useState(0);
  const [estimatedFare, setEstimatedFare] = useState({ min: 0, max: 0 });
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  // Calculate Distance & Fare
  useEffect(() => {
    if (pickup && dropoff && isLoaded) {
      setIsCalculating(true);
      const service = new window.google.maps.DistanceMatrixService();
      service.getDistanceMatrix(
        {
          origins: [{ lat: pickup.lat, lng: pickup.lng }],
          destinations: [{ lat: dropoff.lat, lng: dropoff.lng }],
          travelMode: 'DRIVING',
        },
        (response, status) => {
          setIsCalculating(false);
          if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
            const distanceMeters = response.rows[0].elements[0].distance.value;
            const km = distanceMeters / 1000;
            setDistanceKm(km);

            // Car logic
            const maxFare = Math.round(100 + (80 * km));
            // Bike/Three-Wheeler logic
            const minFare = Math.round(60 + (50 * km));
            
            setEstimatedFare({ min: minFare, max: maxFare });
          } else {
            setError('Could not calculate distance between these locations.');
          }
        }
      );
    } else {
      setDistanceKm(0);
      setEstimatedFare({ min: 0, max: 0 });
    }
  }, [pickup, dropoff, isLoaded]);

  const onPickupPlaceChanged = () => {
    if (autocompletePickup.current !== null) {
      const place = autocompletePickup.current.getPlace();
      if (place.geometry) {
        setPickup({
          address: place.formatted_address || place.name,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
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
          lng: place.geometry.location.lng()
        });
      }
    }
  };

  const handleSearch = async () => {
    if (!pickup || !dropoff || !departureTime) {
      setError('Please provide pickup, drop-off, and departure time.');
      return;
    }
    setError('');
    setIsSearching(true);

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('user_id', session.user.id)
      .single();

    if (userError) {
      setError('Could not verify profile.');
      setIsSearching(false);
      return;
    }

    const [hours, minutes] = departureTime.split(':');
    const departureDate = new Date();
    departureDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

    const { data, error: insertError } = await supabase
      .from('requests')
      .insert({
        passenger_id: userData.id,
        pickup_location: pickup.address,
        dropoff_location: dropoff.address,
        pickup_time: departureDate.toISOString(),
        seats_needed: seatsNeeded,
      })
      .select()
      .single();

    setIsSearching(false);

    if (insertError) {
      setError(insertError.message);
    } else {
      navigate('/ride-matches', { 
        state: { 
          request: data,
          estimatedFare,
          distanceKm
        } 
      });
    }
  };

  if (!isLoaded) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">
          progress_activity
        </span>
      </div>
    );
  }

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

          {error && (
            <div className="mb-6 p-4 bg-error/10 text-error rounded-xl text-sm font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 animate-fade-up stagger-2">
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
                        fields: ['formatted_address', 'geometry', 'name']
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
                        fields: ['formatted_address', 'geometry', 'name']
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

            <div className="space-y-4 animate-fade-up stagger-3">
              <div className="bg-surface-container-low rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="font-label text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60 ml-1">
                      Departure Time
                    </label>
                    <div className="relative">
                      <input
                        className="w-full bg-surface-container-lowest ghost-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-semibold"
                        type="time"
                        value={departureTime}
                        onChange={(e) => setDepartureTime(e.target.value)}
                      />
                    </div>
                  </div>
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

                  {/* Estimated Fare Display */}
                  <div className="bg-surface-container-lowest ghost-border rounded-xl px-4 py-3 flex justify-between items-center">
                    <div>
                      <span className="font-label text-[10px] font-bold uppercase tracking-wider text-primary">Est. Fare</span>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {distanceKm > 0 ? `${distanceKm.toFixed(1)} km route` : 'Enter route to calculate'}
                      </p>
                    </div>
                    {isCalculating ? (
                      <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                    ) : distanceKm > 0 ? (
                      <span className="font-headline font-bold text-lg">Rs. {estimatedFare.min} - {estimatedFare.max}</span>
                    ) : (
                      <span className="font-headline font-bold text-lg text-on-surface-variant/40">Rs. 0</span>
                    )}
                  </div>
                </div>
                
                <button 
                  onClick={handleSearch}
                  disabled={isSearching || !pickup || !dropoff || !departureTime}
                  className="w-full py-4 bg-gradient-to-r from-primary to-primary-container text-white font-headline font-bold rounded-full shadow-lg shadow-primary/20 btn-press disabled:opacity-50 flex justify-center items-center gap-2 animate-pulse-glow"
                >
                  {isSearching ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : 'Search Routes'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Suggested Routes / Quick Actions */}
        <section>
          <div className="flex justify-between items-end mb-6">
            <h3 className="font-headline font-bold text-xl text-on-surface ml-6">Recent Journeys</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-surface-container-lowest p-5 rounded-3xl shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-2xl bg-tertiary-container/10">
                  <span className="material-symbols-outlined text-tertiary">work</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="font-headline font-bold text-on-surface">Majestic City, Bambalapitiya</p>
                <p className="text-on-surface-variant/60 text-sm">18 mins average commute</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <BottomNavBar activeTab="home" />
    </div>
  );
}
