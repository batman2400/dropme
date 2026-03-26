import { useState, useEffect } from 'react';
import TopNavBar from '../components/TopNavBar';
import BottomNavBar from '../components/BottomNavBar';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

export default function Activity() {
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const isDriver = profile?.user_type === 'driver';

  useEffect(() => {
    if (!profile) return;

    const fetchActivity = async () => {
      try {
        if (isDriver) {
          // Fetch all rides this driver has posted
          const { data, error } = await supabase
            .from('rides')
            .select('*')
            .eq('driver_id', profile.id)
            .order('created_at', { ascending: false });
          if (error) throw error;
          setItems(data || []);
        } else {
          // Fetch all requests this passenger has made
          const { data, error } = await supabase
            .from('requests')
            .select('*')
            .eq('passenger_id', profile.id)
            .order('created_at', { ascending: false });
          if (error) throw error;
          setItems(data || []);
        }
      } catch (err) {
        console.error('Error fetching activity:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivity();
  }, [profile, isDriver]);

  const handleCancelRide = async (rideId) => {
    if (!window.confirm('Are you sure you want to cancel this ride?')) return;
    setDeletingId(rideId);
    try {
      const { error } = await supabase
        .from('rides')
        .delete()
        .eq('id', rideId);
      if (error) throw error;
      setItems(prev => prev.filter(item => item.id !== rideId));
    } catch (err) {
      console.error('Error deleting ride:', err);
      alert('Failed to cancel ride. You might not have permission.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return 'Today';
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32">
      <TopNavBar showAvatar showNotification />

      <main className="px-6 pt-8 max-w-screen-xl mx-auto">
        <section className="mb-8">
          <p className="font-label text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">
            Your History
          </p>
          <h2 className="font-headline font-extrabold text-3xl tracking-tight">Recent Activity</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            {isDriver ? 'Rides you have offered' : 'Your ride requests'}
          </p>
        </section>

        {/* Activity Timeline */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant/30">
              <span className="material-symbols-outlined text-4xl text-outline mb-3">history</span>
              <p className="font-headline font-bold text-lg">No activity yet</p>
              <p className="text-sm text-on-surface-variant mt-1">
                {isDriver ? 'Offer your first ride to see it here.' : 'Search for a ride to get started.'}
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="bg-surface-container-lowest p-5 rounded-3xl shadow-sm flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isDriver ? 'bg-tertiary/10' : 'bg-primary/10'}`}>
                  <span className={`material-symbols-outlined text-xl ${isDriver ? 'text-tertiary' : 'text-primary'}`}>
                    {isDriver ? 'steering_wheel_heat' : 'directions_car'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-on-surface truncate">
                      {isDriver
                        ? `${item.starting_point?.split(',')[0]} → ${item.end_point?.split(',')[0]}`
                        : `${item.pickup_location?.split(',')[0]} → ${item.dropoff_location?.split(',')[0]}`
                      }
                    </h4>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider shrink-0 ml-2">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant">
                    {isDriver
                      ? `${item.vehicle_type} • ${item.available_seats} seat${item.available_seats > 1 ? 's' : ''} • ${item.status}`
                      : `${item.seats_needed} seat${item.seats_needed > 1 ? 's' : ''} needed • ${item.status}`
                    }
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {isDriver && item.calculated_fare && (
                      <span className="inline-block text-xs font-bold text-tertiary bg-tertiary/10 px-3 py-1 rounded-full">
                        Rs. {item.calculated_fare}
                      </span>
                    )}
                    {isDriver && item.status === 'active' && (
                      <button
                        onClick={() => handleCancelRide(item.id)}
                        disabled={deletingId === item.id}
                        className="inline-flex items-center gap-1 text-xs font-bold text-error bg-error/10 px-3 py-1 rounded-full hover:bg-error/20 transition-colors active:scale-95 disabled:opacity-50"
                      >
                        {deletingId === item.id ? (
                          <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-sm">delete</span>
                        )}
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <BottomNavBar activeTab="activity" />
    </div>
  );
}
