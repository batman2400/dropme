import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
import BottomNavBar from '../components/BottomNavBar';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export default function PassengerActiveRide() {
  const { requestId } = useParams(); // from URL: /my-ride/:requestId
  const navigate = useNavigate();
  const { session } = useAuth();

  // ─── State ────────────────────────────────────────────────
  const [requestData, setRequestData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading, pending, accepted, rejected, cancelled
  const [error, setError] = useState('');

  // ─── 1. Fetch initial request data ────────────────────────
  const fetchRequestData = useCallback(async () => {
    if (!session?.user || !requestId) return;

    try {
      // We use a nested select to get the ride and the driver's profile in one go
      const { data, error: fetchErr } = await supabase
        .from('ride_requests')
        .select(`
          *,
          ride:rides (
            id,
            start_address,
            end_address,
            vehicle_type,
            departure_time,
            price_per_seat,
            driver:profiles!rides_driver_id_fkey (
              full_name,
              avatar_url,
              rating_avg,
              vehicle_plate,
              phone_number
            )
          )
        `)
        .eq('id', requestId)
        .eq('passenger_id', session.user.id)
        .single();

      if (fetchErr || !data) {
        setError('Ride request not found or you do not have permission to view it.');
        setStatus('error');
        return;
      }

      setRequestData(data);
      setStatus(data.status); // likely 'pending' initially
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load ride data.');
      setStatus('error');
    }
  }, [session, requestId]);

  useEffect(() => {
    fetchRequestData();
  }, [fetchRequestData]);

  // ─── 2. Supabase Realtime Subscription ────────────────────
  useEffect(() => {
    if (!requestId || status === 'error') return;

    // Listen only to this specific request's updates
    const channel = supabase
      .channel(`passenger-request-${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ride_requests',
          filter: `id=eq.${requestId}`
        },
        (payload) => {
          // The driver just accepted or rejected!
          const newStatus = payload.new.status;
          setStatus(newStatus);
          
          // Optionally update local requestData to keep it in sync
          setRequestData((prev) => prev ? { ...prev, status: newStatus } : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, status]);

  // ─── Render Helpers ───────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">
          progress_activity
        </span>
      </div>
    );
  }

  if (status === 'error' || !requestData) {
    return (
      <div className="bg-surface min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <span className="material-symbols-outlined text-4xl text-error">error</span>
        <p className="text-center font-bold text-lg">{error || 'An error occurred'}</p>
        <button
          onClick={() => navigate('/find-ride')}
          className="px-6 py-3 bg-primary text-white rounded-full font-bold text-sm"
        >
          Find Another Ride
        </button>
      </div>
    );
  }

  // Common data for the views
  const ride = requestData.ride;
  const driver = ride.driver;
  const driverName = driver?.full_name || 'Anonymous Driver';
  const driverAvatar = driver?.avatar_url;
  const driverRating = driver?.rating_avg || '5.0';
  const vehicleLabel = ride.vehicle_type === 'tuk' ? 'Tuk-Tuk' : ride.vehicle_type.charAt(0).toUpperCase() + ride.vehicle_type.slice(1);
  const vehicleIcon = ride.vehicle_type === 'bike' ? 'two_wheeler' : ride.vehicle_type === 'tuk' ? 'electric_rickshaw' : 'directions_car';
  const departureDate = new Date(ride.departure_time);
  const timeString = departureDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateString = departureDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // ─── View: Pending ────────────────────────────────────────
  if (status === 'pending') {
    return (
      <div className="bg-surface text-on-surface font-body min-h-screen pb-28">
        <TopNavBar showAvatar showNotification />
        
        <main className="px-6 pt-10 content-grid">
          <div className="flex flex-col items-center justify-center space-y-8 animate-fade-up">
            
            {/* Pulsing Loading Animation */}
            <div className="relative flex items-center justify-center w-32 h-32">
              <div className="absolute inset-0 border-4 border-amber-500/20 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
              <div className="absolute inset-2 border-4 border-amber-500/40 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]"></div>
              <div className="relative z-10 w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
                 <span className="material-symbols-outlined text-white text-3xl animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>
                   hourglass_empty
                 </span>
              </div>
            </div>

            <div className="text-center space-y-2">
              <h2 className="font-headline text-2xl font-bold tracking-tight">Waiting for driver...</h2>
              <p className="text-on-surface-variant text-sm max-w-[260px] mx-auto">
                We've sent your request to the driver. They will confirm your seat soon.
              </p>
            </div>

            {/* Request Summary Card */}
            <div className="w-full bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/20 mt-4">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-outline-variant/20">
                 <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                   route
                 </span>
                 <div>
                   <p className="font-bold text-sm">Requested Route</p>
                   <p className="text-xs text-on-surface-variant">{requestData.seats_requested} seat{requestData.seats_requested > 1 ? 's' : ''} • {timeString}</p>
                 </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-3">
                   <span className="material-symbols-outlined text-outline text-[16px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>my_location</span>
                   <p className="text-sm font-medium leading-tight">{requestData.pickup_address}</p>
                </div>
                <div className="flex gap-3">
                   <span className="material-symbols-outlined text-primary text-[16px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                   <p className="text-sm font-medium leading-tight">{requestData.dropoff_address}</p>
                </div>
              </div>
            </div>
          </div>
        </main>
        
        <BottomNavBar activeTab="activity" />
      </div>
    );
  }

  // ─── View: Rejected ───────────────────────────────────────
  if (status === 'rejected' || status === 'cancelled') {
    return (
      <div className="bg-surface text-on-surface font-body min-h-screen pb-28">
        <TopNavBar showAvatar showNotification />
        
        <main className="px-6 pt-16 content-grid">
          <div className="flex flex-col items-center justify-center space-y-6 animate-fade-up">
            <div className="w-24 h-24 bg-error/10 rounded-full flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-error text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                cancel
              </span>
            </div>

            <div className="text-center space-y-2">
              <h2 className="font-headline text-2xl font-bold tracking-tight">Request Declined</h2>
              <p className="text-on-surface-variant text-sm max-w-[280px] mx-auto">
                Sorry, the driver couldn't accept your request this time. Don't worry, there are plenty of other rides available.
              </p>
            </div>

            <button
              onClick={() => navigate('/find-ride')}
              className="mt-6 w-full max-w-[280px] bg-primary text-white py-4 rounded-full font-bold shadow-md shadow-primary/20 active:scale-95 transition-transform"
            >
              Find Another Ride
            </button>
          </div>
        </main>
        
        <BottomNavBar activeTab="activity" />
      </div>
    );
  }

  // ─── View: Accepted ───────────────────────────────────────
  if (status === 'accepted') {
    return (
      <div className="bg-surface text-on-surface font-body min-h-screen pb-28">
        <TopNavBar showAvatar showNotification />
        
        <main className="px-6 pt-6 content-grid">
          
          {/* Success Header */}
          <div className="flex flex-col items-center text-center animate-fade-down mb-8">
             <div className="w-16 h-16 bg-gradient-to-br from-[#34A853] to-[#0F9D58] rounded-full flex items-center justify-center shadow-lg shadow-[#34A853]/30 mb-4 scale-in-center">
               <span className="material-symbols-outlined text-white text-3xl font-extrabold">check</span>
             </div>
             <h2 className="font-headline text-3xl font-extrabold tracking-tight">Driver Confirmed!</h2>
             <p className="text-on-surface-variant text-sm mt-1">Your seat is reserved inside this ride.</p>
          </div>

          {/* Driver & Vehicle Info Card */}
          <section className="bg-surface-container-lowest rounded-[24px] p-6 shadow-sm border border-outline-variant/20 mb-6 animate-fade-up stagger-2 relative overflow-hidden">
             {/* Decorative background accent */}
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
             
             <div className="flex items-start gap-4 mb-6">
                <div className="relative">
                  {driverAvatar ? (
                    <img src={driverAvatar} alt={driverName} className="w-16 h-16 rounded-full object-cover border-4 border-surface" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-headline font-extrabold text-2xl border-4 border-surface">
                      {driverName.charAt(0)}
                    </div>
                  )}
                  {/* Verified Badge */}
                  <div className="absolute -bottom-1 -right-1 bg-[#34A853] rounded-full p-1 border-2 border-surface">
                    <span className="material-symbols-outlined text-white text-[12px] font-bold">verified</span>
                  </div>
                </div>

                <div className="flex-1 pt-1">
                   <h3 className="font-headline font-bold text-xl">{driverName}</h3>
                   <div className="flex items-center gap-2 mt-1">
                     <span className="inline-flex items-center bg-tertiary-container text-on-tertiary-container text-[11px] font-bold px-2 py-0.5 rounded-full">
                       <span className="material-symbols-outlined text-[12px] mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                       {driverRating}
                     </span>
                     <span className="text-on-surface-variant text-xs">•</span>
                     <span className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider">Driver</span>
                   </div>
                </div>
             </div>

             {/* Vehicle Details Strip */}
             <div className="bg-surface-container py-3 px-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                     <span className="material-symbols-outlined text-primary">{vehicleIcon}</span>
                   </div>
                   <div>
                     <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">Vehicle</p>
                     <p className="font-bold text-sm">{vehicleLabel}</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">Plate Number</p>
                   <p className="font-headline font-extrabold text-lg text-primary bg-primary/10 px-3 py-1 rounded-md border border-primary/20">{driver.vehicle_plate || 'N/A'}</p>
                </div>
             </div>
          </section>

          {/* Payment & Trip Details */}
          <section className="bg-surface-container-lowest rounded-[24px] p-6 shadow-sm border border-outline-variant/20 animate-fade-up stagger-3">
             <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4 mb-4">
                <div>
                   <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">To Pay in Cash</p>
                   <h4 className="font-headline text-3xl font-extrabold text-primary">Rs. {requestData.fare}</h4>
                </div>
                <div className="bg-success/10 text-success p-3 rounded-2xl">
                   <span className="material-symbols-outlined text-3xl">payments</span>
                </div>
             </div>

             <div className="space-y-4 pt-2">
                <div className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-outline mt-0.5">calendar_clock</span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">Date & Time</p>
                    <p className="font-semibold text-sm">{dateString} at {timeString}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-outline mt-0.5">groups</span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">Seats Booked</p>
                    <p className="font-semibold text-sm">{requestData.seats_requested} passenger{requestData.seats_requested > 1 ? 's' : ''}</p>
                  </div>
                </div>
             </div>
          </section>

          {/* WhatsApp Contact Button */}
          {driver?.phone_number && (
            <a
              href={`https://wa.me/${driver.phone_number.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi ${driverName}, I'm your passenger for the ride from ${ride.start_address?.split(',')[0]} to ${ride.end_address?.split(',')[0]}. My seats are confirmed! 🚗`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-3 bg-[#25D366] text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-[#25D366]/20 active:scale-[0.98] transition-transform animate-fade-up stagger-4"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Contact {driverName.split(' ')[0]} on WhatsApp
            </a>
          )}

        </main>
        
        <BottomNavBar activeTab="activity" />
      </div>
    );
  }

  return null; // fallback
}
