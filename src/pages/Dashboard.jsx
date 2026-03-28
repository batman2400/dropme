import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BottomNavBar from '../components/BottomNavBar';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';

export default function Dashboard() {
  const { profile } = useAuth();
  const { unreadCount, markAllRead, activeRideIds } = useNotifications();
  const navigate = useNavigate();
  const [rides, setRides] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const displayName = profile?.full_name?.split(' ')[0] || 'there';
  const avatarUrl = profile?.avatar_url;

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    const fetchRides = async () => {
      try {
        const { data, error } = await supabase
          .from('rides')
          .select(`
            id,
            start_address,
            end_address,
            departure_time,
            price_per_seat,
            vehicle_type,
            available_seats,
            status,
            driver:profiles!rides_driver_id_fkey (
              full_name,
              avatar_url,
              rating_avg
            )
          `)
          .eq('status', 'active')
          .gte('available_seats', 1)
          .order('departure_time', { ascending: true })
          .limit(5);

        if (error) throw error;
        setRides(data || []);
      } catch (err) {
        console.error('Error fetching rides:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRides();
  }, []);

  const vehicleIcons = {
    bike: 'two_wheeler',
    tuk: 'electric_rickshaw',
    car: 'directions_car',
  };

  const handleNotificationClick = () => {
    markAllRead();
    if (activeRideIds.length > 0) {
      navigate(`/active-ride/${activeRideIds[0]}`);
    } else {
      navigate('/activity');
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen pb-24">
      {/* Top Bar */}
      <header className="w-full pt-safe pb-3 flex justify-between items-center px-5 sm:px-6 content-grid animate-fade-in">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/10" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <span className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.12em] font-label block">
              {greeting}
            </span>
            <h1 className="text-lg font-extrabold text-on-surface font-headline tracking-tight leading-none">
              dropme<span className="text-primary">.</span>
            </h1>
          </div>
        </div>
        <button
          onClick={handleNotificationClick}
          className="relative w-9 h-9 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant/60 btn-press"
        >
          <span className="material-symbols-outlined text-[20px]"
            style={unreadCount > 0 ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            notifications
          </span>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-scale-in">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </header>

      <main className="px-5 sm:px-6 space-y-7 content-grid">
        {/* Hero */}
        <section className="mt-1 animate-fade-up">
          <h2 className="font-headline font-extrabold text-[1.75rem] sm:text-3xl text-on-surface tracking-tight leading-[1.15] text-balance">
            Where to,
            <br />
            <span className="text-primary">{displayName}?</span>
          </h2>
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-2 gap-3 animate-fade-up stagger-2">
          <Link
            to="/find-ride"
            className="flex flex-col justify-between p-5 h-40 sm:h-44 bg-gradient-to-br from-primary via-primary to-primary-container rounded-2xl text-white shadow-lg shadow-primary/15 relative overflow-hidden btn-press text-left group"
          >
            <div className="z-10 bg-white/15 w-10 h-10 flex items-center justify-center rounded-xl backdrop-blur-sm group-hover:bg-white/25 transition-colors">
              <span className="material-symbols-outlined text-lg">search</span>
            </div>
            <div className="z-10">
              <p className="font-headline font-extrabold text-base sm:text-lg leading-tight">
                Find a<br />Ride
              </p>
            </div>
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/8 rounded-full blur-2xl"></div>
            <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-white/5 rounded-full blur-xl"></div>
          </Link>
          <Link
            to="/offer-ride"
            className="flex flex-col justify-between p-5 h-40 sm:h-44 bg-surface-container-highest rounded-2xl text-on-surface border border-outline-variant/8 btn-press text-left group"
          >
            <div className="bg-primary/8 w-10 h-10 flex items-center justify-center rounded-xl group-hover:bg-primary/15 transition-colors">
              <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                directions_car
              </span>
            </div>
            <div>
              <p className="font-headline font-extrabold text-base sm:text-lg text-primary leading-tight">
                Offer a<br />Ride
              </p>
            </div>
          </Link>
        </section>

        {/* Rides Feed */}
        <section className="space-y-4 animate-fade-up stagger-3">
          <div className="flex justify-between items-end">
            <h3 className="font-headline font-bold text-lg">Rides Near You</h3>
            <Link to="/find-ride" className="text-primary font-bold text-[10px] font-label uppercase tracking-[0.12em] btn-press px-2 py-1 rounded-lg">
              See All →
            </Link>
          </div>

          <div className="space-y-2.5">
            {isLoading ? (
              <div className="space-y-2.5">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-surface-container-lowest p-4 rounded-2xl space-y-3 border border-outline-variant/6">
                    <div className="flex items-center gap-3">
                      <div className="skeleton w-9 h-9 rounded-full"></div>
                      <div className="flex-1 space-y-1.5">
                        <div className="skeleton h-3.5 w-2/3 rounded-lg"></div>
                        <div className="skeleton h-2.5 w-1/3 rounded-lg"></div>
                      </div>
                      <div className="skeleton h-5 w-14 rounded-full"></div>
                    </div>
                    <div className="skeleton h-9 w-full rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : rides.length === 0 ? (
              <div className="text-center py-10 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/15 animate-scale-in">
                <span className="material-symbols-outlined text-3xl text-outline/30 mb-2 block">directions_car</span>
                <p className="font-headline font-bold text-on-surface/70 text-sm">No rides available yet</p>
                <p className="text-xs text-on-surface-variant mt-1">Be the first to offer a ride today!</p>
              </div>
            ) : (
              rides.map((ride, index) => {
                const driverName = ride.driver?.full_name || 'Anonymous Driver';
                const driverAvatar = ride.driver?.avatar_url;
                const rideTime = new Date(ride.departure_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                const startShort = ride.start_address?.split(',')[0] || 'Unknown';
                const endShort = ride.end_address?.split(',')[0] || 'Unknown';
                const vIcon = vehicleIcons[ride.vehicle_type] || 'directions_car';

                return (
                  <div
                    key={ride.id}
                    className={`bg-surface-container-lowest p-4 rounded-2xl flex flex-col gap-2.5 border border-outline-variant/6 interactive-card animate-fade-up stagger-${Math.min(index + 1, 5)}`}
                  >
                    {/* Driver row */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        {driverAvatar ? (
                          <img src={driverAvatar} alt={driverName} className="w-9 h-9 rounded-full object-cover ring-1 ring-outline-variant/10" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-tertiary-container to-tertiary flex items-center justify-center text-white font-bold text-xs">
                            {driverName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold text-on-surface text-sm leading-tight">{driverName}</h4>
                          <div className="flex items-center gap-1 text-on-surface-variant">
                            <span className="material-symbols-outlined text-[12px]">{vIcon}</span>
                            <span className="text-[10px] font-semibold uppercase font-label tracking-wider">{ride.vehicle_type}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-primary/6 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-primary font-label">
                        {rideTime}
                      </div>
                    </div>

                    {/* Route */}
                    <div className="relative pl-5 py-0.5">
                      <div className="absolute left-[3px] top-1 bottom-1 w-[1.5px] bg-gradient-to-b from-primary/60 to-outline-variant/20 rounded-full"></div>
                      <div className="absolute left-0 top-[5px] w-[7px] h-[7px] rounded-full bg-primary ring-2 ring-primary/10"></div>
                      <div className="absolute left-0 bottom-[5px] w-[7px] h-[7px] rounded-full bg-outline-variant/40"></div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium text-on-surface-variant">{startShort}</p>
                        <p className="text-[13px] font-bold text-on-surface">{endShort}</p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-bold text-tertiary bg-tertiary/6 px-2 py-0.5 rounded-full">
                          {ride.available_seats} seat{ride.available_seats > 1 ? 's' : ''} left
                        </span>
                        {ride.price_per_seat && (
                          <span className="text-[9px] font-bold text-primary bg-primary/6 px-2 py-0.5 rounded-full">
                            from Rs. {ride.price_per_seat}
                          </span>
                        )}
                      </div>
                      <Link
                        to="/find-ride"
                        className="bg-primary text-white px-3.5 py-1.5 rounded-full text-[10px] font-bold font-label uppercase tracking-[0.08em] btn-press shadow-sm shadow-primary/10"
                      >
                        Find Ride
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      <BottomNavBar activeTab="home" />
    </div>
  );
}
