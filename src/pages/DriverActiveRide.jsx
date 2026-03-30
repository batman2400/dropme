import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
import BottomNavBar from '../components/BottomNavBar';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export default function DriverActiveRide() {
  const { rideId } = useParams();       // from URL: /active-ride/:rideId
  const navigate = useNavigate();
  const { session } = useAuth();

  // ─── State ────────────────────────────────────────────────
  const [ride, setRide] = useState(null);
  const [requests, setRequests] = useState([]);   // all pending + accepted
  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(null); // requestId being processed
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');

  // ─── Helpers ──────────────────────────────────────────────
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const acceptedRequests = requests.filter(r => r.status === 'accepted');
  const totalAcceptedSeats = acceptedRequests.reduce((sum, r) => sum + r.seats_requested, 0);

  // ─── 1. Fetch ride + existing requests on mount ───────────
  const fetchRideData = useCallback(async () => {
    if (!session?.user || !rideId) return;

    try {
      // Fetch the ride (only if this driver owns it)
      const { data: rideData, error: rideErr } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .eq('driver_id', session.user.id)
        .single();

      if (rideErr || !rideData) {
        setError('Ride not found or you do not have permission to view it.');
        setIsLoading(false);
        return;
      }
      setRide(rideData);

      // Fetch existing requests (pending + accepted) with passenger profile
      const { data: reqData, error: reqErr } = await supabase
        .from('ride_requests')
        .select(`
          *,
          passenger:profiles!ride_requests_passenger_id_fkey (
            full_name,
            avatar_url,
            rating_avg,
            phone_number
          )
        `)
        .eq('ride_id', rideId)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: true });

      if (reqErr) throw reqErr;
      setRequests(reqData || []);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load ride data.');
    } finally {
      setIsLoading(false);
    }
  }, [session, rideId]);

  useEffect(() => {
    fetchRideData();
  }, [fetchRideData]);

  // ─── 2. Supabase Realtime subscription ────────────────────
  // This is the magic: we listen for changes to ride_requests
  // in real-time, so new requests appear INSTANTLY.
  useEffect(() => {
    if (!rideId) return;

    const channel = supabase
      .channel(`ride-requests-${rideId}`)
      // Listen for NEW requests (INSERT)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_requests',
          filter: `ride_id=eq.${rideId}`,
        },
        async (payload) => {
          // A passenger just requested this ride!
          // Fetch the full request with passenger profile
          const { data } = await supabase
            .from('ride_requests')
            .select(`
              *,
              passenger:profiles!ride_requests_passenger_id_fkey (
                full_name,
                avatar_url,
                rating_avg,
                phone_number
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setRequests(prev => {
              // Avoid duplicates (in case we already fetched it)
              if (prev.some(r => r.id === data.id)) return prev;
              return [...prev, data];
            });
          }
        }
      )
      // Listen for UPDATES (accept/reject/cancel)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ride_requests',
          filter: `ride_id=eq.${rideId}`,
        },
        (payload) => {
          const newStatus = payload.new.status;

          if (newStatus === 'cancelled' || newStatus === 'rejected') {
            // Check if this was an accepted request (passenger cancelled after acceptance)
            setRequests(prev => {
              const oldRequest = prev.find(r => r.id === payload.new.id);
              // If the cancelled request was previously accepted, restore seats
              if (oldRequest && oldRequest.status === 'accepted') {
                setRide(prevRide => prevRide ? ({
                  ...prevRide,
                  available_seats: prevRide.available_seats + oldRequest.seats_requested,
                }) : prevRide);
              }
              // Remove from the list
              return prev.filter(r => r.id !== payload.new.id);
            });
          } else {
            // Update status in place (e.g., pending -> accepted)
            setRequests(prev =>
              prev.map(r =>
                r.id === payload.new.id
                  ? { ...r, status: newStatus }
                  : r
              )
            );
          }
        }
      )
      .subscribe();

    // Cleanup: unsubscribe when component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideId]);

  // ─── 3. Accept a request ──────────────────────────────────
  const handleAccept = async (request) => {
    // Check if enough seats remain
    if (ride.available_seats < request.seats_requested) {
      setError(`Not enough seats! Only ${ride.available_seats} remaining.`);
      return;
    }

    setActionInProgress(request.id);
    setError('');

    try {
      // Step 1: Update the request status to 'accepted', BUT ONLY if it is still pending
      const { data: updatedRows, error: updateErr } = await supabase
        .from('ride_requests')
        .update({ status: 'accepted' })
        .eq('id', request.id)
        .eq('status', 'pending')
        .select();

      if (updateErr) throw updateErr;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('This request is no longer pending (it may have been cancelled).');
      }

      // Step 2: Atomically decrement available_seats using our RPC function
      const { error: rpcErr } = await supabase
        .rpc('decrement_seats', {
          ride_id_input: rideId,
          seats_to_remove: request.seats_requested,
        });

      if (rpcErr) throw rpcErr;

      // Step 3: Update local state
      setRequests(prev =>
        prev.map(r => r.id === request.id ? { ...r, status: 'accepted' } : r)
      );
      setRide(prev => ({
        ...prev,
        available_seats: Math.max(prev.available_seats - request.seats_requested, 0),
      }));
    } catch (err) {
      console.error('Accept error:', err);
      setError('Failed to accept request. Please try again.');
    } finally {
      setActionInProgress(null);
    }
  };

  // ─── 4. Reject a request ──────────────────────────────────
  const handleReject = async (request) => {
    setActionInProgress(request.id);
    setError('');

    try {
      const { error: updateErr } = await supabase
        .from('ride_requests')
        .update({ status: 'rejected' })
        .eq('id', request.id);

      if (updateErr) throw updateErr;

      // Remove from local state (rejected = gone from view)
      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (err) {
      console.error('Reject error:', err);
      setError('Failed to reject request.');
    } finally {
      setActionInProgress(null);
    }
  };

  // ─── 5. Google Maps Navigation Handoff ────────────────────
  // Builds the universal Google Maps Directions URL with all
  // accepted passengers' pickup/dropoff as waypoints.
  const handleStartNavigation = async () => {
    if (acceptedRequests.length === 0) {
      setError('Accept at least one passenger before starting navigation.');
      return;
    }

    setIsStarting(true);
    setError('');

    try {
      // Update ride status to 'in_progress'
      const { error: statusErr } = await supabase
        .from('rides')
        .update({ status: 'in_progress' })
        .eq('id', rideId);

      if (statusErr) throw statusErr;

      // Build the Google Maps URL
      const origin = `${ride.start_lat},${ride.start_lng}`;
      const destination = `${ride.end_lat},${ride.end_lng}`;

      // Waypoints: all pickups first, then all dropoffs
      const waypoints = acceptedRequests
        .flatMap(req => [
          `${req.pickup_lat},${req.pickup_lng}`,
          `${req.dropoff_lat},${req.dropoff_lng}`,
        ])
        .join('|');

      const googleMapsUrl =
        `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;

      // Open Google Maps (native app on mobile, browser on desktop)
      window.open(googleMapsUrl, '_blank');

      // Update local state
      setRide(prev => ({ ...prev, status: 'in_progress' }));
    } catch (err) {
      console.error('Start navigation error:', err);
      setError('Failed to start navigation.');
    } finally {
      setIsStarting(false);
    }
  };

  // ─── Loading state ────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">
          progress_activity
        </span>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="bg-surface min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <span className="material-symbols-outlined text-4xl text-error">error</span>
        <p className="text-center font-bold text-lg">{error || 'Ride not found'}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-3 bg-primary text-white rounded-full font-bold text-sm"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ─── Display helpers ──────────────────────────────────────
  const vehicleIcon = ride.vehicle_type === 'bike' ? 'two_wheeler'
    : ride.vehicle_type === 'tuk' ? 'electric_rickshaw' : 'directions_car';
  const vehicleLabel = ride.vehicle_type === 'tuk' ? 'Tuk-Tuk'
    : ride.vehicle_type.charAt(0).toUpperCase() + ride.vehicle_type.slice(1);
  const departureTime = new Date(ride.departure_time).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });
  const isInProgress = ride.status === 'in_progress';

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-24">
      <TopNavBar showAvatar showNotification />

      <main className="px-5 sm:px-6 pt-3 content-grid">
        {/* ── Ride Header ── */}
        <section className="mb-5 animate-fade-up">
          <span className="font-label text-[9px] font-semibold uppercase tracking-wider text-primary mb-1 block">
            {isInProgress ? '🚗 Ride in Progress' : '📡 Live — Waiting for Passengers'}
          </span>
          <h2 className="font-headline text-[1.5rem] sm:text-2xl font-extrabold tracking-tight leading-[1.15] mb-2.5">
            {ride.start_address?.split(',')[0]}
            <span className="text-primary/30 font-normal text-base"> → </span>
            {ride.end_address?.split(',')[0]}
          </h2>

          {/* Ride stats strip */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/6 text-primary">
              <span className="material-symbols-outlined text-[11px]">{vehicleIcon}</span>
              {vehicleLabel}
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/6 text-primary">
              <span className="material-symbols-outlined text-[11px]">schedule</span>
              {departureTime}
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-tertiary/6 text-tertiary">
              <span className="material-symbols-outlined text-[11px]">event_seat</span>
              {ride.available_seats} seat{ride.available_seats !== 1 ? 's' : ''} left
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/6 text-primary">
              Rs. {ride.price_per_seat}/seat
            </span>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3.5 bg-error/6 text-error border border-error/10 rounded-xl text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            {error}
          </div>
        )}

        {/* ── Pending Requests ── */}
        {pendingRequests.length > 0 && (
          <section className="mb-8 animate-fade-up stagger-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
              <h3 className="font-headline font-bold text-lg">
                Incoming Request{pendingRequests.length > 1 ? 's' : ''}
              </h3>
              <span className="bg-amber-500/10 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {pendingRequests.length} new
              </span>
            </div>

            <div className="space-y-4">
              {pendingRequests.map((req) => (
                <RequestCard
                  key={req.id}
                  request={req}
                  type="pending"
                  isProcessing={actionInProgress === req.id}
                  onAccept={() => handleAccept(req)}
                  onReject={() => handleReject(req)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Accepted Passengers ── */}
        <section className="mb-8 animate-fade-up stagger-3">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-tertiary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
            <h3 className="font-headline font-bold text-lg">
              Accepted Passengers
            </h3>
            {acceptedRequests.length > 0 && (
              <span className="bg-tertiary/10 text-tertiary text-[10px] font-bold px-2 py-0.5 rounded-full">
                {totalAcceptedSeats} seat{totalAcceptedSeats !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {acceptedRequests.length === 0 ? (
            <div className="text-center py-8 bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant/20">
              <span className="material-symbols-outlined text-3xl text-outline mb-2">person_off</span>
              <p className="text-sm text-on-surface-variant font-medium">
                No passengers accepted yet.
              </p>
              <p className="text-xs text-on-surface-variant/60 mt-1">
                Requests will appear here in real-time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {acceptedRequests.map((req) => (
                <RequestCard
                  key={req.id}
                  request={req}
                  type="accepted"
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Start Navigation Button ── */}
        {!isInProgress ? (
          <section className="mb-6">
            <button
              onClick={handleStartNavigation}
              disabled={isStarting || acceptedRequests.length === 0}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#34A853] to-[#0F9D58] text-white py-4 sm:py-5 rounded-full font-headline font-extrabold text-lg tracking-tight shadow-lg shadow-[#34A853]/30 btn-press disabled:opacity-50 disabled:shadow-none"
            >
              {isStarting ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">navigation</span>
                  Start Navigation
                </>
              )}
            </button>
            {acceptedRequests.length === 0 && (
              <p className="text-center text-[10px] text-on-surface-variant mt-3 font-medium">
                Accept at least one passenger to start navigation
              </p>
            )}
          </section>
        ) : (
          <section className="mb-6">
            <div className="bg-tertiary/10 rounded-2xl p-5 text-center">
              <span className="material-symbols-outlined text-tertiary text-3xl mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>
                navigation
              </span>
              <p className="font-headline font-bold text-lg text-tertiary">Ride in Progress</p>
              <p className="text-sm text-on-surface-variant mt-1">
                Follow the Google Maps navigation. Have a safe trip!
              </p>
              <button
                onClick={handleStartNavigation}
                className="mt-4 px-6 py-2.5 bg-tertiary text-white rounded-full font-bold text-sm"
              >
                Re-open Navigation
              </button>
            </div>
          </section>
        )}

        {/* No requests at all — waiting state */}
        {pendingRequests.length === 0 && acceptedRequests.length === 0 && (
          <section className="animate-fade-up stagger-4">
            <div className="text-center py-10 bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant/20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-3xl animate-pulse">
                  cell_tower
                </span>
              </div>
              <p className="font-headline font-bold text-lg">Listening for passengers...</p>
              <p className="text-sm text-on-surface-variant mt-2 max-w-[260px] mx-auto">
                Your ride is live! Requests will appear here instantly when passengers find your route.
              </p>
            </div>
          </section>
        )}
      </main>

      <BottomNavBar activeTab="activity" />
    </div>
  );
}

// ─── Request Card Component ─────────────────────────────────
// Displays a single ride request (either pending or accepted)
function RequestCard({ request, type, isProcessing, onAccept, onReject }) {
  const passenger = request.passenger;
  const passengerName = passenger?.full_name || 'Passenger';
  const passengerAvatar = passenger?.avatar_url;
  const passengerRating = passenger?.rating_avg || '5.0';

  const pickupShort = request.pickup_address?.split(',')[0] || 'Pickup';
  const dropoffShort = request.dropoff_address?.split(',')[0] || 'Dropoff';

  return (
    <div className={`bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/6 ${
      type === 'pending' ? 'border-l-[3px] border-l-amber-500' : 'border-l-[3px] border-l-tertiary'
    }`}>
      <div className="p-4">
        {/* Passenger info */}
        <div className="flex items-center gap-3 mb-4">
          {passengerAvatar ? (
            <img
              src={passengerAvatar}
              alt={passengerName}
              className="w-11 h-11 rounded-xl object-cover border-2 border-surface-container-high"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-tertiary-container flex items-center justify-center text-on-tertiary-container font-headline font-bold text-base border-2 border-surface-container-high">
              {passengerName.charAt(0)}
            </div>
          )}
          <div className="flex-1">
            <h4 className="font-bold text-base">{passengerName}</h4>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span className="flex items-center gap-0.5">
                <span className="material-symbols-outlined text-amber-500 text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                {passengerRating}
              </span>
              <span>·</span>
              <span>{request.seats_requested} seat{request.seats_requested > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="font-headline font-bold text-lg text-primary">Rs. {request.fare}</span>
          </div>
        </div>

        {/* Route */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex flex-col items-center pt-0.5">
            <span className="material-symbols-outlined text-primary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              radio_button_checked
            </span>
            <div className="w-0.5 h-6 bg-outline-variant/30"></div>
            <span className="material-symbols-outlined text-error text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              location_on
            </span>
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/50">Pickup</p>
              <p className="text-sm font-medium">{pickupShort}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/50">Drop-off</p>
              <p className="text-sm font-medium">{dropoffShort}</p>
            </div>
          </div>
        </div>

        {/* Accept / Reject buttons (only for pending) */}
        {type === 'pending' && (
          <div className="flex gap-3">
            <button
              onClick={onReject}
              disabled={isProcessing}
              className="flex-1 py-3 rounded-xl border-2 border-outline-variant/20 text-on-surface-variant font-bold text-sm flex items-center justify-center gap-2 hover:bg-error/5 hover:border-error/30 hover:text-error transition-all active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? (
                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">close</span>
                  Decline
                </>
              )}
            </button>
            <button
              onClick={onAccept}
              disabled={isProcessing}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-container text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? (
                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">check</span>
                  Accept
                </>
              )}
            </button>
          </div>
        )}

        {/* Accepted badge (for accepted) */}
        {type === 'accepted' && (
          <div className="flex items-center justify-center gap-2 py-2 bg-tertiary/8 rounded-xl">
            <span className="material-symbols-outlined text-tertiary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <span className="text-tertiary font-bold text-xs uppercase tracking-wider">Confirmed</span>
          </div>
        )}
      </div>
    </div>
  );
}
