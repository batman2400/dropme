import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
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
            starting_point,
            end_point,
            departure_time,
            calculated_fare,
            vehicle_type,
            available_seats,
            status,
            driver:users (
              full_name,
              phone_number
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

  const handleWhatsAppClick = (phone, rideId) => {
    if (!phone) return;
    // Strip ALL non-digit characters (spaces, dashes, +, parentheses, etc.)
    let formattedPhone = phone.replace(/\D/g, '');
    // If starts with 0, replace with Sri Lanka country code
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '94' + formattedPhone.substring(1);
    }
    const text = encodeURIComponent(`Hi, I saw your ride (ID: ${rideId.substring(0,6).toUpperCase()}) on dropme. Are seats still available?`);
    window.open(`https://wa.me/${formattedPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen pb-32">
      {/* Top App Bar */}
      <header className="w-full pt-12 pb-4 flex justify-between items-center px-6 max-w-screen-xl mx-auto bg-surface">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-white font-bold text-lg">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider font-label">
              {greeting},
            </span>
            <h1 className="text-2xl font-black text-[#0b1c30] font-headline tracking-tight">dropme.</h1>
          </div>
        </div>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95">
          <span className="material-symbols-outlined">notifications</span>
        </button>
      </header>

      <main className="px-6 space-y-8 max-w-screen-xl mx-auto">
        {/* Hero Greeting */}
        <section className="mt-4">
          <h2 className="font-headline font-bold text-3xl text-on-surface tracking-tight leading-tight">
            Where to,
            <br />
            <span className="text-primary">{displayName}?</span>
          </h2>
        </section>

        {/* Quick Actions Grid */}
        <section className="grid grid-cols-2 gap-4">
          <Link
            to="/find-ride"
            className="flex flex-col justify-between p-6 h-48 bg-primary rounded-[2rem] text-white shadow-xl relative overflow-hidden active:scale-95 transition-transform text-left"
          >
            <div className="z-10 bg-white/20 w-12 h-12 flex items-center justify-center rounded-full backdrop-blur-md">
              <span className="material-symbols-outlined">search</span>
            </div>
            <div className="z-10">
              <p className="font-headline font-extrabold text-xl">
                Find a<br />Ride
              </p>
            </div>
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
          </Link>
          <Link
            to="/offer-ride"
            className="flex flex-col justify-between p-6 h-48 bg-surface-container-highest rounded-[2rem] text-on-surface active:scale-95 transition-transform text-left"
          >
            <div className="bg-primary/10 w-12 h-12 flex items-center justify-center rounded-full">
              <span className="material-symbols-outlined text-primary">steering_wheel_heat</span>
            </div>
            <div>
              <p className="font-headline font-extrabold text-xl text-primary">
                Offer a<br />Ride
              </p>
            </div>
          </Link>
        </section>

        {/* Live Feed: Rides Near You */}
        <section className="space-y-6">
          <div className="flex justify-between items-end">
            <h3 className="font-headline font-bold text-xl">Rides Near You</h3>
            <Link to="/ride-matches" className="text-primary font-semibold text-sm font-label uppercase tracking-widest">
              See All
            </Link>
          </div>
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
              </div>
            ) : rides.length === 0 ? (
              <div className="text-center py-12 bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant/30">
                <span className="material-symbols-outlined text-4xl text-outline mb-3">directions_car_off</span>
                <p className="font-headline font-bold text-lg">No rides available</p>
                <p className="text-sm text-on-surface-variant mt-1">Be the first to offer a ride today!</p>
              </div>
            ) : (
              rides.map((ride) => {
                const driverName = ride.driver?.full_name || 'Anonymous Driver';
                const driverPhone = ride.driver?.phone_number || '';
                const rideTime = new Date(ride.departure_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                const startShort = ride.starting_point?.split(',')[0] || 'Unknown';
                const endShort = ride.end_point?.split(',')[0] || 'Unknown';

                return (
                  <div key={ride.id} className="bg-surface-container-lowest p-5 rounded-[2rem] flex flex-col gap-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-tertiary-container flex items-center justify-center text-on-tertiary-container font-bold text-lg">
                          {driverName.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-on-surface">{driverName}</h4>
                          <div className="flex items-center gap-1 text-on-surface-variant">
                            <span className="material-symbols-outlined text-sm">directions_car</span>
                            <span className="text-[10px] font-bold uppercase font-label">{ride.vehicle_type}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-surface-container-low px-3 py-1 rounded-full text-xs font-bold text-primary font-label">
                        {rideTime}
                      </div>
                    </div>
                    <div className="relative pl-6 py-1">
                      <div className="absolute left-1 top-0 bottom-0 w-0.5 bg-outline-variant/30 flex flex-col justify-between items-center py-1">
                        <div className="w-2 h-2 rounded-full bg-primary ring-4 ring-primary/10"></div>
                        <div className="w-2 h-2 rounded-full bg-outline-variant"></div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-on-surface-variant">{startShort}</p>
                        <p className="text-sm font-bold text-on-surface">{endShort}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-tertiary bg-tertiary/10 px-3 py-1 rounded-full">
                          {ride.available_seats} seat{ride.available_seats > 1 ? 's' : ''} left
                        </span>
                        {ride.calculated_fare && (
                          <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                            Rs. {ride.calculated_fare}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleWhatsAppClick(driverPhone, ride.id)}
                        disabled={!driverPhone}
                        className="bg-primary-container text-white px-5 py-2.5 rounded-full text-xs font-bold font-label uppercase tracking-widest active:scale-90 transition-transform disabled:opacity-50"
                      >
                        Join Ride
                      </button>
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
