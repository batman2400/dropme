import { useState, useEffect } from 'react';
import TopNavBar from '../components/TopNavBar';
import BottomNavBar from '../components/BottomNavBar';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

export default function Activity() {
  const { profile } = useAuth();
  const [driverRides, setDriverRides] = useState([]);
  const [passengerRequests, setPassengerRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'offered', 'requested'

  useEffect(() => {
    if (!profile) return;

    const fetchActivity = async () => {
      try {
        // Fetch rides offered by this user (as driver)
        const { data: rides } = await supabase
          .from('rides')
          .select('*')
          .eq('driver_id', profile.id)
          .order('created_at', { ascending: false });

        // Fetch ride requests made by this user (as passenger)
        const { data: requests } = await supabase
          .from('ride_requests')
          .select('*')
          .eq('passenger_id', profile.id)
          .order('created_at', { ascending: false });

        setDriverRides(rides || []);
        setPassengerRequests(requests || []);
      } catch (err) {
        console.error('Error fetching activity:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivity();
  }, [profile]);

  const handleCancelRide = async (rideId) => {
    if (!window.confirm('Are you sure you want to cancel this ride?')) return;
    setDeletingId(rideId);
    try {
      const { error } = await supabase
        .from('rides')
        .delete()
        .eq('id', rideId);
      if (error) throw error;
      setDriverRides(prev => prev.filter(item => item.id !== rideId));
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

  // Build combined items list based on active tab
  const getFilteredItems = () => {
    const offered = driverRides.map(r => ({ ...r, _type: 'offered' }));
    const requested = passengerRequests.map(r => ({ ...r, _type: 'requested' }));

    if (activeTab === 'offered') return offered;
    if (activeTab === 'requested') return requested;
    // 'all' - merge and sort by created_at
    return [...offered, ...requested].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  };

  const items = getFilteredItems();
  const totalCount = driverRides.length + passengerRequests.length;

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-28">
      <TopNavBar showAvatar showNotification />

      <main className="px-6 pt-8 content-grid">
        <section className="mb-6 animate-fade-up">
          <p className="font-label text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">
            Your History
          </p>
          <h2 className="font-headline font-extrabold text-3xl tracking-tight">My Rides</h2>
        </section>

        {/* Filter Tabs */}
        {totalCount > 0 && (
          <div className="flex gap-2 mb-6 animate-fade-up stagger-2">
            {[
              { key: 'all', label: `All (${totalCount})` },
              { key: 'offered', label: `Offered (${driverRides.length})` },
              { key: 'requested', label: `Requested (${passengerRequests.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  activeTab === tab.key
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

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
                Offer or search for a ride to get started.
              </p>
            </div>
          ) : (
            items.map((item, index) => {
              const isOffered = item._type === 'offered';
              return (
                <div key={item.id} className={`bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex items-start gap-4 interactive-card animate-fade-up stagger-${Math.min(index + 1, 5)}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isOffered ? 'bg-tertiary/10' : 'bg-primary/10'}`}>
                    <span className={`material-symbols-outlined text-xl ${isOffered ? 'text-tertiary' : 'text-primary'}`}>
                      {isOffered ? 'directions_car' : 'hail'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-on-surface truncate">
                        {isOffered
                          ? `${item.start_address?.split(',')[0]} → ${item.end_address?.split(',')[0]}`
                          : `${item.pickup_address?.split(',')[0]} → ${item.dropoff_address?.split(',')[0]}`
                        }
                      </h4>
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider shrink-0 ml-2">
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOffered ? 'bg-tertiary/10 text-tertiary' : 'bg-primary/10 text-primary'
                      }`}>
                        {isOffered ? 'Driver' : 'Passenger'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.status === 'active' || item.status === 'accepted' ? 'bg-green-100 text-green-700' :
                        item.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        item.status === 'rejected' || item.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-surface-container-high text-on-surface-variant'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-sm text-on-surface-variant">
                      {isOffered
                        ? `${item.vehicle_type} • ${item.available_seats} seat${item.available_seats > 1 ? 's' : ''} • Rs. ${item.price_per_seat}/seat`
                        : `${item.seats_requested} seat${item.seats_requested > 1 ? 's' : ''} • Rs. ${item.fare}`
                      }
                    </p>
                    {/* Cancel button for active driver rides */}
                    {isOffered && item.status === 'active' && (
                      <button
                        onClick={() => handleCancelRide(item.id)}
                        disabled={deletingId === item.id}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-error bg-error/10 px-3 py-1 rounded-full hover:bg-error/20 transition-colors active:scale-95 disabled:opacity-50"
                      >
                        {deletingId === item.id ? (
                          <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-sm">delete</span>
                        )}
                        Cancel Ride
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

