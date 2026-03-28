import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import BottomNavBar from '../components/BottomNavBar';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

export default function Dashboard() {
  const { profile } = useAuth();
  const [rides, setRides] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const displayName = profile?.full_name?.split(' ')[0] || 'there';

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



  return (
    <div className="bg-surface text-on-surface font-body min-h-screen pb-28">
      {/* Top App Bar */}
      <header className="w-full pt-safe pb-4 flex justify-between items-center px-6 content-grid animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary/20">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-[0.15em] font-label">
              {greeting}
            </span>
            <h1 className="text-2xl font-black text-[#0b1c30] font-headline tracking-tight">dropme.</h1>
          </div>
        </div>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant btn-press">
          <span className="material-symbols-outlined">notifications</span>
        </button>
      </header>

      <main className="px-6 space-y-8 content-grid">
        {/* Hero Greeting */}
        <section className="mt-2 animate-fade-up">
          <h2 className="font-headline font-bold text-3xl sm:text-4xl text-on-surface tracking-tight leading-tight text-balance">
            Where to,
            <br />
            <span className="text-primary">{displayName}?</span>
          </h2>
        </section>

        {/* Quick Actions Grid */}
        <section className="grid grid-cols-2 gap-4 animate-fade-up stagger-2">
          <Link
            to="/find-ride"
            className="flex flex-col justify-between p-5 sm:p-6 h-44 sm:h-48 bg-gradient-to-br from-primary to-primary-container rounded-[1.75rem] text-white shadow-xl shadow-primary/20 relative overflow-hidden btn-press text-left group"
          >
            <div className="z-10 bg-white/20 w-11 h-11 flex items-center justify-center rounded-full backdrop-blur-md group-hover:bg-white/30 transition-colors">
              <span className="material-symbols-outlined text-xl">search</span>
            </div>
            <div className="z-10">
              <p className="font-headline font-extrabold text-lg sm:text-xl leading-tight">
                Find a<br />Ride
              </p>
            </div>
            <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-white/5 rounded-full blur-xl"></div>
          </Link>
          <Link
            to="/offer-ride"
            className="flex flex-col justify-between p-5 sm:p-6 h-44 sm:h-48 bg-surface-container-highest rounded-[1.75rem] text-on-surface btn-press text-left group"
          >
            <div className="bg-primary/10 w-11 h-11 flex items-center justify-center rounded-full group-hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                directions_car
              </span>
            </div>
            <div>
              <p className="font-headline font-extrabold text-lg sm:text-xl text-primary leading-tight">
                Offer a<br />Ride
              </p>
            </div>
          </Link>
        </section>

        {/* Live Feed: Rides Near You */}
        <section className="space-y-5 animate-fade-up stagger-3">
          <div className="flex justify-between items-end">
            <h3 className="font-headline font-bold text-xl">Rides Near You</h3>
            <Link to="/ride-matches" className="text-primary font-bold text-xs font-label uppercase tracking-[0.15em] btn-press px-2 py-1 rounded-lg">
              See All →
            </Link>
          </div>
          <div className="space-y-3">
            {isLoading ? (
              /* Skeleton Loading */
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-surface-container-lowest p-5 rounded-[1.75rem] space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="skeleton w-10 h-10 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-4 w-2/3 rounded-lg"></div>
                        <div className="skeleton h-3 w-1/3 rounded-lg"></div>
                      </div>
                      <div className="skeleton h-6 w-16 rounded-full"></div>
                    </div>
                    <div className="skeleton h-10 w-full rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : rides.length === 0 ? (
              <div className="text-center py-12 bg-surface-container-low rounded-[1.75rem] border-2 border-dashed border-outline-variant/20 animate-scale-in">
                <span className="material-symbols-outlined text-4xl text-outline/40 mb-3 block">directions_car</span>
                <p className="font-headline font-bold text-lg text-on-surface/80">No rides available</p>
                <p className="text-sm text-on-surface-variant mt-1">Be the first to offer a ride today!</p>
              </div>
            ) : (
              rides.map((ride, index) => {
                const driverName = ride.driver?.full_name || 'Anonymous Driver';
                const rideTime = new Date(ride.departure_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                const startShort = ride.start_address?.split(',')[0] || 'Unknown';
                const endShort = ride.end_address?.split(',')[0] || 'Unknown';

                return (
                  <div
                    key={ride.id}
                    className={`bg-surface-container-lowest p-5 rounded-[1.75rem] flex flex-col gap-3 shadow-sm interactive-card animate-fade-up stagger-${Math.min(index + 1, 5)}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-tertiary-container to-tertiary flex items-center justify-center text-white font-bold text-sm">
                          {driverName.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-on-surface text-sm">{driverName}</h4>
                          <div className="flex items-center gap-1 text-on-surface-variant">
                            <span className="material-symbols-outlined text-xs">directions_car</span>
                            <span className="text-[10px] font-bold uppercase font-label tracking-wider">{ride.vehicle_type}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-primary/8 px-3 py-1 rounded-full text-[11px] font-bold text-primary font-label">
                        {rideTime}
                      </div>
                    </div>
                    <div className="relative pl-6 py-1">
                      <div className="absolute left-[3px] top-1 bottom-1 w-[2px] bg-gradient-to-b from-primary to-outline-variant/30 rounded-full"></div>
                      <div className="absolute left-0 top-1 w-2 h-2 rounded-full bg-primary ring-[3px] ring-primary/10"></div>
                      <div className="absolute left-0 bottom-1 w-2 h-2 rounded-full bg-outline-variant/50"></div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-on-surface-variant">{startShort}</p>
                        <p className="text-sm font-bold text-on-surface">{endShort}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-tertiary bg-tertiary/8 px-2.5 py-1 rounded-full">
                          {ride.available_seats} seat{ride.available_seats > 1 ? 's' : ''} left
                        </span>
                        {ride.price_per_seat && (
                          <span className="text-[10px] font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-full">
                            Rs. {ride.price_per_seat}/seat
                          </span>
                        )}
                      </div>
                      <Link
                        to="/find-ride"
                        className="bg-gradient-to-r from-primary to-primary-container text-white px-4 py-2 rounded-full text-[10px] font-bold font-label uppercase tracking-[0.12em] btn-press shadow-md shadow-primary/15"
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
