import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Autocomplete } from '@react-google-maps/api';
import TopNavBar from '../components/TopNavBar';
import BottomNavBar from '../components/BottomNavBar';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleMaps } from '../contexts/GoogleMapsProvider';

export default function OfferRide() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { isLoaded } = useGoogleMaps();

  // User details
  const [vehicleType, setVehicleType] = useState('Car');
  const [availableSeats, setAvailableSeats] = useState(2);
  const [departureTime, setDepartureTime] = useState('');

  // Map / Route Details
  const autocompletePickup = useRef(null);
  const autocompleteDropoff = useRef(null);
  
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  
  const [distanceKm, setDistanceKm] = useState(0);
  const [calculatedFare, setCalculatedFare] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState('');

  // Fetch driver details on mount
  useEffect(() => {
    const fetchUserVehicle = async () => {
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('vehicle_type')
          .eq('user_id', session.user.id)
          .single();
        if (data?.vehicle_type) {
          setVehicleType(data.vehicle_type);
        }
      }
    };
    fetchUserVehicle();
  }, [session]);

  // Dynamic Pricing Logic
  useEffect(() => {
    if (pickup && dropoff && isLoaded) {
      calculateDistanceAndFare();
    } else {
      setCalculatedFare(0);
      setDistanceKm(0);
    }
  }, [pickup, dropoff, vehicleType, isLoaded]);

  const calculateDistanceAndFare = () => {
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

          // Pricing Strategy
          let baseFare = 0;
          let perKm = 0;
          
          if (['Bike', 'Three-Wheeler'].includes(vehicleType)) {
            baseFare = 60;
            perKm = 50;
          } else {
            // Car / EV / WagonR / default
            baseFare = 100;
            perKm = 80;
          }
          
          const totalFare = Math.round(baseFare + (perKm * km));
          setCalculatedFare(totalFare);
        } else {
          setError('Could not calculate distance between these locations.');
        }
      }
    );
  };

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

  const handlePublish = async () => {
    if (!pickup || !dropoff || !departureTime || !availableSeats) {
      setError('Please fill in all details before publishing.');
      return;
    }
    setError('');
    setIsPublishing(true);

    // Get the user's uuid from the 'users' table linking to auth
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('user_id', session.user.id)
      .single();

    if (userError) {
      setError('Could not verify driver profile.');
      setIsPublishing(false);
      return;
    }

    // Insert into rides table
    // Note: requires calculated_fare column in rides table
    const [hours, minutes] = departureTime.split(':');
    const departureDate = new Date();
    departureDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

    const { error: insertError } = await supabase
      .from('rides')
      .insert({
        driver_id: userData.id,
        starting_point: pickup.address,
        end_point: dropoff.address,
        departure_time: departureDate.toISOString(),
        available_seats: availableSeats,
        vehicle_type: vehicleType,
        calculated_fare: calculatedFare, // Ensure this column exists in DB
      });

    if (insertError) {
      setError(insertError.message);
      setIsPublishing(false);
    } else {
      setIsPublishing(false);
      navigate('/dashboard'); // or a success page
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
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32">
      <TopNavBar showAvatar showNotification />

      <main className="px-6 mt-4 max-w-xl mx-auto">
        <section className="mb-10">
          <span className="font-label text-[10px] font-semibold uppercase tracking-wider text-primary mb-2 block">
            Driver Console
          </span>
          <h2 className="font-headline text-3xl font-extrabold tracking-tight leading-none mb-4">
            Share your journey,
            <br />
            <span className="text-primary-container">share the cost.</span>
          </h2>
        </section>

        {error && (
          <div className="mb-6 p-4 bg-error/10 text-error rounded-xl text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
          </div>
        )}

        {/* Offering Form */}
        <section className="space-y-6">
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
                      fields: ['formatted_address', 'geometry', 'name']
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
                      fields: ['formatted_address', 'geometry', 'name']
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

          <div className="grid grid-cols-2 gap-4">
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
            {/* Available Seats */}
            <div className="bg-surface-container-low rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-lg">group</span>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Seats
                </label>
              </div>
              <select 
                className="w-full bg-surface-container-lowest border-none rounded-lg py-2 px-3 text-body text-sm font-semibold focus:ring-primary shadow-sm"
                value={availableSeats}
                onChange={(e) => setAvailableSeats(Number(e.target.value))}
              >
                <option value={1}>1 Seat</option>
                <option value={2}>2 Seats</option>
                <option value={3}>3 Seats</option>
                <option value={4}>4+ Seats</option>
              </select>
            </div>
          </div>

          {/* Route Preview Card (Dynamic Pricing) */}
          <div className="bg-surface-container-high rounded-xl p-4 flex gap-4 overflow-hidden min-h-[140px] relative">
            <div className="flex-1 py-1 z-10">
              <p className="font-headline font-bold text-lg mb-1">Estimated Earnings</p>
              <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
                {distanceKm > 0 
                  ? `Based on ${distanceKm.toFixed(1)} km route.`
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
              <img
                alt="Map abstract"
                className="w-full h-full object-cover opacity-50 mix-blend-multiply"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAwmlbL1BLFajHsehWVp6hvbp-pQydOskrRT1GGiXWEZvri4Bi2T6ZVdjO0snRBuR9gluF7RFiJoFOWT_uYKig_Av13Hz_RXoA4WhvdE0VA9rQuRxTH8rtCrGsa2i3PJG_YdXsBh1m0urOkHrHn-qTiEUMMLgkt1wyTIGjPuHAuW-HsMWFpkY8_3bfEYGKuONwd_aJsWaDe-FswKJaLND_loUkpoxCb8Mjs2Mm1LdvkORs_tF8YnRAknJi7YQTu8lXY-mriPTuY6DQ"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-surface-container-high"></div>
            </div>
          </div>
        </section>

        {/* Publish Button */}
        <section className="mt-8">
          <button 
            onClick={handlePublish}
            disabled={isPublishing || !pickup || !dropoff || !departureTime}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-primary to-primary-container text-white py-5 rounded-full font-headline font-extrabold text-lg tracking-tight shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
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

      <BottomNavBar activeTab="offer-ride" />
    </div>
  );
}
