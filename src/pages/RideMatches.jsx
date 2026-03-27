import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
import BottomNavBar from '../components/BottomNavBar';
import { supabase } from '../supabaseClient';

export default function RideMatches() {
  const location = useLocation();
  const navigate = useNavigate();
  const { request } = location.state || {};
  
  const [rides, setRides] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        let query = supabase
          .from('rides')
          .select(`
            id,
            starting_point,
            end_point,
            departure_time,
            calculated_fare,
            vehicle_type,
            available_seats,
            driver:users (
              full_name,
              phone_number
            )
          `)
          .eq('status', 'active')
          .gte('available_seats', 1)
          .order('departure_time', { ascending: true });

        // If we have a search request, filter by destination and seats
        if (request) {
          const dropoffKeyword = request.dropoff_location.split(',')[0];
          query = query
            .gte('available_seats', request.seats_needed)
            .ilike('end_point', `%${dropoffKeyword}%`);
        }

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;
        
        setRides(data || []);
      } catch (err) {
        console.error("Error fetching rides:", err);
        setError('Failed to fetch available rides.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMatches();
  }, [request]);

  const handleWhatsAppClick = (phone, rideId) => {
    if (!phone) return;
    // Format phone number to international if not already
    let formattedPhone = phone;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '94' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1);
    }
    
    const text = encodeURIComponent(`Hi, I saw your ride (ID: ${rideId.substring(0,6).toUpperCase()}) on dropme. Are seats still available?`);
    window.open(`https://wa.me/${formattedPhone}?text=${text}`, '_blank');
  };

  // Formatting strings for UI
  const pickupShort = request?.pickup_location?.split(',')[0] || '';
  const dropoffShort = request?.dropoff_location?.split(',')[0] || '';

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen selection:bg-primary-fixed">
      <TopNavBar showAvatar showNotification />

      <main className="px-6 pb-32">
        {/* Search Context Header */}
        <section className="mt-8 mb-10">
          <p className="font-label text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">
            {request ? 'Available Pools' : 'Browse All'}
          </p>
          <h2 className="font-headline font-extrabold text-3xl tracking-tight leading-tight">
            {request ? (
              <>{pickupShort} <span className="text-primary/40 block font-normal text-xl">to</span> {dropoffShort}</>
            ) : (
              'All Available Rides'
            )}
          </h2>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-on-surface-variant font-medium">
              {isLoading ? 'Searching for drivers near you...' : `Found ${rides.length} match${rides.length === 1 ? '' : 'es'}`}
            </span>
          </div>
        </section>

        {error && (
          <div className="mb-6 p-4 bg-error/10 text-error rounded-xl text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
          </div>
        )}

        {/* Result Cards */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
            </div>
          ) : rides.length === 0 ? (
            <div className="text-center py-12 bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant/30">
              <span className="material-symbols-outlined text-4xl text-outline mb-3">directions_car_off</span>
              <p className="font-headline font-bold text-lg">No rides found</p>
              <p className="text-sm text-on-surface-variant mt-1">Try adjusting your destination or departure time.</p>
            </div>
          ) : (
            rides.map((ride, index) => {
              const rideShortId = `DM-${ride.id.substring(0, 4).toUpperCase()}`;
              const rideDate = new Date(ride.departure_time);
              const timeString = rideDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              const driverName = ride.driver?.full_name || 'Anonymous Driver';
              const driverPhone = ride.driver?.phone_number || '';
              
              // Only top card gets full CTA + perforated design (for best match)
              const isBestMatch = index === 0;

              return (
                <div key={ride.id} className={`bg-surface-container-lowest rounded-3xl overflow-hidden shadow-[0_12px_24px_rgba(11,28,48,0.06)] relative ${!isBestMatch && 'opacity-90'}`}>
                  {/* Card Header (Route Info) */}
                  <div className={`p-6 ${isBestMatch ? 'bg-gradient-to-br from-primary to-primary-container text-white' : 'bg-secondary-container/40'}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isBestMatch ? 'opacity-70' : 'text-on-secondary-container/60'}`}>
                          RIDE ID: {rideShortId}
                        </span>
                        <div className={`text-2xl font-headline font-bold ${!isBestMatch && 'text-on-secondary-container'}`}>
                          {timeString}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isBestMatch ? 'opacity-70' : 'text-on-secondary-container/60'}`}>
                          FARE
                        </span>
                        <div className={`text-2xl font-headline font-bold ${!isBestMatch && 'text-on-secondary-container'}`}>
                          Rs. {ride.calculated_fare || 'TBD'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Visual Route Indicator (Only for Best Match) */}
                    {isBestMatch && (
                      <div className="flex justify-between items-center relative py-4">
                        <div className="z-10 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold truncate max-w-[100px]">
                          {(pickupShort || ride.starting_point?.split(',')[0] || '').substring(0,3).toUpperCase()}
                        </div>
                        <div className="flex-1 border-t-2 border-dashed border-white/30 mx-4 relative">
                          <span
                            className="material-symbols-outlined absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white bg-primary p-1 rounded-full scale-75"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            directions_car
                          </span>
                        </div>
                        <div className="z-10 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold truncate max-w-[100px]">
                          {(dropoffShort || ride.end_point?.split(',')[0] || '').substring(0,3).toUpperCase()}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Perforation (Only for best match) */}
                  {isBestMatch && (
                    <div className="flex items-center w-full px-6 py-2 bg-surface-container-lowest">
                      <div className="w-4 h-4 rounded-full bg-surface -ml-8"></div>
                      <div className="flex-1 border-t border-outline-variant/20 border-dashed"></div>
                      <div className="w-4 h-4 rounded-full bg-surface -mr-8"></div>
                    </div>
                  )}

                  {/* Driver Info & CTA */}
                  <div className="p-6">
                    <div className={`flex items-center justify-between ${isBestMatch ? 'mb-6' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-tertiary-container flex items-center justify-center text-on-tertiary-container font-headline font-bold text-lg border-2 border-surface-container-high">
                          {driverName.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{driverName}</h3>
                          <div className="flex items-center gap-1 text-xs font-semibold text-on-surface-variant">
                            <span className="material-symbols-outlined text-[14px] text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                            <span>4.9</span>
                            <span className="mx-1">•</span>
                            <span>{ride.vehicle_type} ({ride.available_seats} seats)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* WhatsApp CTA (Only for Best Match for focus, or all if we want) */}
                    <button 
                      onClick={() => handleWhatsAppClick(driverPhone, ride.id)}
                      disabled={!driverPhone}
                      className={`w-full font-bold py-4 rounded-full flex items-center justify-center gap-3 transition-all active:scale-95 ${
                        isBestMatch 
                          ? 'bg-[#25D366] hover:bg-[#128C7E] text-white shadow-md' 
                          : 'bg-surface-container-high text-on-surface mt-4 hover:bg-surface-container-highest'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                      </svg>
                      {driverPhone ? 'Message on WhatsApp' : 'Number Unavailable'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      <BottomNavBar activeTab="rides" />
    </div>
  );
}
