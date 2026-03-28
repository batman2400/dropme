import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
import BottomNavBar from '../components/BottomNavBar';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export default function RideMatches() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();

  const { matches = [], pickup, dropoff, seatsNeeded = 1 } = location.state || {};

  const [requestingId, setRequestingId] = useState(null);
  const [requestedIds, setRequestedIds] = useState([]);
  const [error, setError] = useState('');

  const handleRequestRide = async (ride) => {
    if (!session?.user) {
      setError('You must be logged in to request a ride.');
      return;
    }

    setRequestingId(ride.id);
    setError('');

    try {
      const { data: existing } = await supabase
        .from('ride_requests')
        .select('id')
        .eq('ride_id', ride.id)
        .eq('passenger_id', session.user.id)
        .in('status', ['pending', 'accepted'])
        .maybeSingle();

      if (existing) {
        setError('You already have an active request for this ride.');
        setRequestingId(null);
        return;
      }

      const { data: insertedRequest, error: insertError } = await supabase
        .from('ride_requests')
        .insert({
          ride_id: ride.id,
          passenger_id: session.user.id,
          seats_requested: seatsNeeded,
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          dropoff_lat: dropoff.lat,
          dropoff_lng: dropoff.lng,
          pickup_address: pickup.address,
          dropoff_address: dropoff.address,
          fare: ride.passengerFare,
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      navigate(`/my-ride/${insertedRequest.id}`);
    } catch (err) {
      console.error('Request error:', err);
      setError(err.message || 'Failed to send ride request.');
    } finally {
      setRequestingId(null);
    }
  };

  const pickupShort = pickup?.address?.split(',')[0] || 'Pickup';
  const dropoffShort = dropoff?.address?.split(',')[0] || 'Dropoff';

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-24">
      <TopNavBar showAvatar showNotification />

      <main className="px-5 sm:px-6 pb-6 content-grid">
        {/* Header */}
        <section className="mt-6 mb-6 animate-fade-up">
          <p className="font-label text-[9px] font-semibold uppercase tracking-wider text-primary mb-1">
            {matches.length > 0 ? 'Matched Rides' : 'No Matches'}
          </p>
          <h2 className="font-headline font-extrabold text-[1.65rem] tracking-tight leading-[1.15]">
            {pickupShort}{' '}
            <span className="text-primary/35 block font-normal text-lg">to</span>{' '}
            {dropoffShort}
          </h2>
          <div className="mt-3">
            <span className="text-sm text-on-surface-variant/70 font-medium">
              {matches.length === 0
                ? 'No rides match your route right now.'
                : `Found ${matches.length} match${matches.length === 1 ? '' : 'es'}`}
            </span>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="mb-5 p-3.5 bg-error/6 text-error border border-error/10 rounded-xl text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            {error}
          </div>
        )}

        {/* Results */}
        <div className="space-y-3">
          {matches.length === 0 ? (
            <div className="text-center py-10 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/15 animate-scale-in">
              <span className="material-symbols-outlined text-3xl text-outline/30 mb-2 block">directions_car_off</span>
              <p className="font-headline font-bold text-sm text-on-surface/70">No rides found</p>
              <p className="text-xs text-on-surface-variant mt-1">Try a different route or check back later.</p>
              <button
                onClick={() => navigate('/find-ride')}
                className="mt-5 px-5 py-2.5 bg-primary text-white rounded-full font-bold text-xs btn-press"
              >
                Search Again
              </button>
            </div>
          ) : (
            matches.map((ride, index) => {
              const isBestMatch = index === 0;
              const isRequested = requestedIds.includes(ride.id);
              const isRequesting = requestingId === ride.id;

              const rideShortId = `DM-${ride.id.substring(0, 4).toUpperCase()}`;
              const rideDate = new Date(ride.departure_time);
              const timeString = rideDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              const driverName = ride.driver?.full_name || 'Anonymous Driver';
              const driverAvatar = ride.driver?.avatar_url;
              const driverRating = ride.driver?.rating_avg || '5.0';

              const vehicleIcon =
                ride.vehicle_type === 'bike' ? 'two_wheeler' :
                ride.vehicle_type === 'tuk' ? 'electric_rickshaw' : 'directions_car';
              const vehicleLabel =
                ride.vehicle_type === 'tuk' ? 'Tuk-Tuk' :
                ride.vehicle_type.charAt(0).toUpperCase() + ride.vehicle_type.slice(1);

              return (
                <div
                  key={ride.id}
                  className={`bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/6 interactive-card animate-fade-up stagger-${Math.min(index + 1, 5)} ${!isBestMatch && 'opacity-90'}`}
                >
                  {/* Header */}
                  <div className={`p-5 ${isBestMatch
                    ? 'bg-gradient-to-br from-primary to-primary-container text-white'
                    : 'bg-surface-container/60'
                  }`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className={`text-[9px] font-bold uppercase tracking-[0.15em] ${
                          isBestMatch ? 'opacity-60' : 'text-on-surface-variant/50'
                        }`}>
                          RIDE {rideShortId}
                        </span>
                        <div className={`text-xl font-headline font-bold ${!isBestMatch && 'text-on-surface'}`}>
                          {timeString}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[9px] font-bold uppercase tracking-[0.15em] ${
                          isBestMatch ? 'opacity-60' : 'text-on-surface-variant/50'
                        }`}>
                          PER PERSON
                        </span>
                        <div className={`text-xl font-headline font-bold ${!isBestMatch && 'text-on-surface'}`}>
                          Rs. {ride.passengerFare}
                        </div>
                        {seatsNeeded > 1 && (
                          <span className={`text-[9px] font-medium ${
                            isBestMatch ? 'opacity-50' : 'text-on-surface-variant/40'
                          }`}>
                            Total: Rs. {ride.passengerFare * seatsNeeded} ({seatsNeeded} seats)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        isBestMatch ? 'bg-white/15 text-white' : 'bg-primary/6 text-primary'
                      }`}>
                        <span className="material-symbols-outlined text-[11px]">timer</span>
                        +{ride.detourMinutes} min
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        isBestMatch ? 'bg-white/15 text-white' : 'bg-primary/6 text-primary'
                      }`}>
                        <span className="material-symbols-outlined text-[11px]">straighten</span>
                        {ride.passengerDistanceKm.toFixed(1)} km
                      </span>
                    </div>

                    {/* Route (best match) */}
                    {isBestMatch && (
                      <div className="flex justify-between items-center relative py-3 mt-1">
                        <div className="z-10 bg-white/10 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[10px] font-bold truncate max-w-[90px]">
                          {ride.start_address?.split(',')[0]?.substring(0, 6).toUpperCase()}
                        </div>
                        <div className="flex-1 border-t-2 border-dashed border-white/25 mx-3 relative">
                          <span
                            className="material-symbols-outlined absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white bg-primary p-0.5 rounded-full text-sm"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {vehicleIcon}
                          </span>
                        </div>
                        <div className="z-10 bg-white/10 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[10px] font-bold truncate max-w-[90px]">
                          {ride.end_address?.split(',')[0]?.substring(0, 6).toUpperCase()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Driver + CTA */}
                  <div className="p-5">
                    <div className={`flex items-center justify-between ${isBestMatch ? 'mb-4' : 'mb-3'}`}>
                      <div className="flex items-center gap-2.5">
                        {driverAvatar ? (
                          <img src={driverAvatar} alt={driverName}
                            className="w-10 h-10 rounded-xl object-cover ring-1 ring-outline-variant/10" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-tertiary-container flex items-center justify-center text-on-tertiary-container font-headline font-bold text-sm ring-1 ring-outline-variant/10">
                            {driverName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-base leading-tight">{driverName}</h3>
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-on-surface-variant/60">
                            <span className="flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">{vehicleIcon}</span>
                              {vehicleLabel}
                            </span>
                            <span>·</span>
                            <span>{ride.available_seats} seat{ride.available_seats > 1 ? 's' : ''}</span>
                            <span>·</span>
                            <span className="flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                              {driverRating}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {isRequested ? (
                      <div className="w-full py-3 rounded-full flex items-center justify-center gap-2 bg-tertiary/8 text-tertiary font-bold text-sm">
                        <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        Request Sent!
                      </div>
                    ) : (
                      <button
                        onClick={() => handleRequestRide(ride)}
                        disabled={isRequesting}
                        className={`w-full font-bold py-3 rounded-full flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-sm ${
                          isBestMatch
                            ? 'bg-gradient-to-r from-primary to-primary-container text-white shadow-sm shadow-primary/15'
                            : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                        } disabled:opacity-50`}
                      >
                        {isRequesting ? (
                          <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-base">hail</span>
                            Request Ride · Rs. {ride.passengerFare}/person
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      <BottomNavBar activeTab="activity" />
    </div>
  );
}
