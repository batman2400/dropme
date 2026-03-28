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

  // Receive matched rides + passenger search context from FindRide
  const { matches = [], pickup, dropoff, seatsNeeded = 1 } = location.state || {};

  const [requestingId, setRequestingId] = useState(null); // ride.id being requested
  const [requestedIds, setRequestedIds] = useState([]);    // rides already requested
  const [error, setError] = useState('');

  // ─── Handle "Request Ride" ────────────────────────────────
  const handleRequestRide = async (ride) => {
    if (!session?.user) {
      setError('You must be logged in to request a ride.');
      return;
    }

    setRequestingId(ride.id);
    setError('');

    try {
      // Guard: Check for existing pending/accepted request on this ride
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

      // Navigate straight to the passenger's waiting room!
      navigate(`/my-ride/${insertedRequest.id}`);
    } catch (err) {
      console.error('Request error:', err);
      setError(err.message || 'Failed to send ride request.');
    } finally {
      setRequestingId(null);
    }
  };

  // ─── Display helpers ──────────────────────────────────────
  const pickupShort = pickup?.address?.split(',')[0] || 'Pickup';
  const dropoffShort = dropoff?.address?.split(',')[0] || 'Dropoff';

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-28">
      <TopNavBar showAvatar showNotification />

      <main className="px-6 pb-8 content-grid">
        {/* Header */}
        <section className="mt-8 mb-8 animate-fade-up">
          <p className="font-label text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">
            {matches.length > 0 ? 'Matched Rides' : 'No Matches'}
          </p>
          <h2 className="font-headline font-extrabold text-3xl tracking-tight leading-tight">
            {pickupShort}{' '}
            <span className="text-primary/40 block font-normal text-xl">to</span>{' '}
            {dropoffShort}
          </h2>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-on-surface-variant font-medium">
              {matches.length === 0
                ? 'No rides match your route right now.'
                : `Found ${matches.length} match${matches.length === 1 ? '' : 'es'}`}
            </span>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-error/10 text-error rounded-xl text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
          </div>
        )}

        {/* Result Cards */}
        <div className="space-y-6">
          {matches.length === 0 ? (
            // ── Empty State ──
            <div className="text-center py-12 bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant/30">
              <span className="material-symbols-outlined text-4xl text-outline mb-3">directions_car_off</span>
              <p className="font-headline font-bold text-lg">No rides found</p>
              <p className="text-sm text-on-surface-variant mt-1">
                No drivers are heading your way right now. Try a different route or check back later.
              </p>
              <button
                onClick={() => navigate('/find-ride')}
                className="mt-6 px-6 py-3 bg-primary text-white rounded-full font-bold text-sm"
              >
                Search Again
              </button>
            </div>
          ) : (
            // ── Ride Cards ──
            matches.map((ride, index) => {
              const isBestMatch = index === 0;
              const isRequested = requestedIds.includes(ride.id);
              const isRequesting = requestingId === ride.id;

              const rideShortId = `DM-${ride.id.substring(0, 4).toUpperCase()}`;
              const rideDate = new Date(ride.departure_time);
              const timeString = rideDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const driverName = ride.driver?.full_name || 'Anonymous Driver';
              const driverAvatar = ride.driver?.avatar_url;
              const driverRating = ride.driver?.rating_avg || '5.0';

              // Vehicle icon
              const vehicleIcon =
                ride.vehicle_type === 'bike'
                  ? 'two_wheeler'
                  : ride.vehicle_type === 'tuk'
                  ? 'electric_rickshaw'
                  : 'directions_car';

              const vehicleLabel =
                ride.vehicle_type === 'tuk'
                  ? 'Tuk-Tuk'
                  : ride.vehicle_type.charAt(0).toUpperCase() + ride.vehicle_type.slice(1);

              return (
                <div
                  key={ride.id}
                  className={`bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm interactive-card animate-fade-up stagger-${Math.min(
                    index + 1,
                    5
                  )} relative ${!isBestMatch && 'opacity-90'}`}
                >
                  {/* Card Header */}
                  <div
                    className={`p-6 ${
                      isBestMatch
                        ? 'bg-gradient-to-br from-primary to-primary-container text-white'
                        : 'bg-secondary-container/40'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                            isBestMatch ? 'opacity-70' : 'text-on-secondary-container/60'
                          }`}
                        >
                          RIDE {rideShortId}
                        </span>
                        <div
                          className={`text-2xl font-headline font-bold ${
                            !isBestMatch && 'text-on-secondary-container'
                          }`}
                        >
                          {timeString}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                            isBestMatch ? 'opacity-70' : 'text-on-secondary-container/60'
                          }`}
                        >
                          YOUR FARE
                        </span>
                        <div
                          className={`text-2xl font-headline font-bold ${
                            !isBestMatch && 'text-on-secondary-container'
                          }`}
                        >
                          Rs. {ride.passengerFare}
                        </div>
                      </div>
                    </div>

                    {/* Detour badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          isBestMatch
                            ? 'bg-white/20 text-white'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        <span className="material-symbols-outlined text-xs">timer</span>
                        +{ride.detourMinutes} min detour
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          isBestMatch
                            ? 'bg-white/20 text-white'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        <span className="material-symbols-outlined text-xs">straighten</span>
                        {ride.passengerDistanceKm.toFixed(1)} km
                      </span>
                    </div>

                    {/* Route visualization (best match only) */}
                    {isBestMatch && (
                      <div className="flex justify-between items-center relative py-4 mt-2">
                        <div className="z-10 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold truncate max-w-[100px]">
                          {ride.start_address?.split(',')[0]?.substring(0, 6).toUpperCase()}
                        </div>
                        <div className="flex-1 border-t-2 border-dashed border-white/30 mx-4 relative">
                          <span
                            className="material-symbols-outlined absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white bg-primary p-1 rounded-full scale-75"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {vehicleIcon}
                          </span>
                        </div>
                        <div className="z-10 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold truncate max-w-[100px]">
                          {ride.end_address?.split(',')[0]?.substring(0, 6).toUpperCase()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Perforation (best match only) */}
                  {isBestMatch && (
                    <div className="flex items-center w-full px-6 py-2 bg-surface-container-lowest">
                      <div className="w-4 h-4 rounded-full bg-surface -ml-8"></div>
                      <div className="flex-1 border-t border-outline-variant/20 border-dashed"></div>
                      <div className="w-4 h-4 rounded-full bg-surface -mr-8"></div>
                    </div>
                  )}

                  {/* Driver Info + CTA */}
                  <div className="p-6">
                    <div className={`flex items-center justify-between ${isBestMatch ? 'mb-6' : 'mb-4'}`}>
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        {driverAvatar ? (
                          <img
                            src={driverAvatar}
                            alt={driverName}
                            className="w-12 h-12 rounded-2xl object-cover border-2 border-surface-container-high"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-tertiary-container flex items-center justify-center text-on-tertiary-container font-headline font-bold text-lg border-2 border-surface-container-high">
                            {driverName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-lg">{driverName}</h3>
                          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
                            <span className="flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[14px]">{vehicleIcon}</span>
                              {vehicleLabel}
                            </span>
                            <span>·</span>
                            <span>{ride.available_seats} seat{ride.available_seats > 1 ? 's' : ''}</span>
                            <span>·</span>
                            <span className="flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[14px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                              {driverRating}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Request Ride CTA */}
                    {isRequested ? (
                      <div className="w-full py-4 rounded-full flex items-center justify-center gap-2 bg-tertiary-container text-on-tertiary-container font-bold">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        Request Sent!
                      </div>
                    ) : (
                      <button
                        onClick={() => handleRequestRide(ride)}
                        disabled={isRequesting}
                        className={`w-full font-bold py-4 rounded-full flex items-center justify-center gap-3 transition-all active:scale-95 ${
                          isBestMatch
                            ? 'bg-gradient-to-r from-primary to-primary-container text-white shadow-md shadow-primary/20'
                            : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                        } disabled:opacity-50`}
                      >
                        {isRequesting ? (
                          <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        ) : (
                          <>
                            <span className="material-symbols-outlined">hail</span>
                            Request Ride · Rs. {ride.passengerFare}
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
