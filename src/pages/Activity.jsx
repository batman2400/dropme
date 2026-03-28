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
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (!profile) return;

    const fetchActivity = async () => {
      try {
        const { data: rides } = await supabase
          .from('rides')
          .select('*')
          .eq('driver_id', profile.id)
          .order('created_at', { ascending: false });

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
      alert('Failed to cancel ride.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to cancel this ride request?')) return;
    setDeletingId(requestId);
    try {
      const { error } = await supabase
        .from('ride_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId);
      if (error) throw error;
      setPassengerRequests(prev =>
        prev.map(item => item.id === requestId ? { ...item, status: 'cancelled' } : item)
      );
    } catch (err) {
      console.error('Error cancelling request:', err);
      alert('Failed to cancel request.');
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

  const getFilteredItems = () => {
    const offered = driverRides.map(r => ({ ...r, _type: 'offered' }));
    const requested = passengerRequests.map(r => ({ ...r, _type: 'requested' }));

    if (activeTab === 'offered') return offered;
    if (activeTab === 'requested') return requested;
    return [...offered, ...requested].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  };

  const items = getFilteredItems();
  const totalCount = driverRides.length + passengerRequests.length;

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-24">
      <TopNavBar showAvatar showNotification />

      <main className="px-5 sm:px-6 pt-6 content-grid">
        <section className="mb-5 animate-fade-up">
          <p className="font-label text-[9px] font-semibold uppercase tracking-wider text-primary mb-1">
            Your History
          </p>
          <h2 className="font-headline font-extrabold text-[1.65rem] tracking-tight">My Rides</h2>
        </section>

        {/* Filter Tabs */}
        {totalCount > 0 && (
          <div className="flex gap-1.5 mb-5 animate-fade-up stagger-2">
            {[
              { key: 'all', label: `All (${totalCount})` },
              { key: 'offered', label: `Offered (${driverRides.length})` },
              { key: 'requested', label: `Requested (${passengerRequests.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                  activeTab === tab.key
                    ? 'bg-primary text-white shadow-sm shadow-primary/15'
                    : 'bg-surface-container-low text-on-surface-variant/70 hover:bg-surface-container-high'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-2.5">
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/15 animate-scale-in">
              <span className="material-symbols-outlined text-3xl text-outline/30 mb-2 block">history</span>
              <p className="font-headline font-bold text-sm text-on-surface/70">No activity yet</p>
              <p className="text-xs text-on-surface-variant mt-1">Offer or search for a ride to get started.</p>
            </div>
          ) : (
            items.map((item, index) => {
              const isOffered = item._type === 'offered';
              return (
                <div key={item.id} className={`bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/6 flex items-start gap-3 interactive-card animate-fade-up stagger-${Math.min(index + 1, 5)}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isOffered ? 'bg-tertiary/6' : 'bg-primary/6'}`}>
                    <span className={`material-symbols-outlined text-lg ${isOffered ? 'text-tertiary' : 'text-primary'}`}>
                      {isOffered ? 'directions_car' : 'hail'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-on-surface text-sm truncate leading-tight">
                        {isOffered
                          ? `${item.start_address?.split(',')[0]} → ${item.end_address?.split(',')[0]}`
                          : `${item.pickup_address?.split(',')[0]} → ${item.dropoff_address?.split(',')[0]}`
                        }
                      </h4>
                      <span className="text-[9px] font-semibold text-on-surface-variant/50 uppercase tracking-wider shrink-0 ml-2">
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        isOffered ? 'bg-tertiary/6 text-tertiary' : 'bg-primary/6 text-primary'
                      }`}>
                        {isOffered ? 'Driver' : 'Passenger'}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        item.status === 'active' || item.status === 'accepted' ? 'bg-tertiary/8 text-tertiary' :
                        item.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                        item.status === 'rejected' || item.status === 'cancelled' ? 'bg-error/8 text-error' :
                        'bg-surface-container-high text-on-surface-variant'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant/60">
                      {isOffered
                        ? `${item.vehicle_type} • ${item.available_seats} seat${item.available_seats > 1 ? 's' : ''} • Rs. ${item.price_per_seat}`
                        : `${item.seats_requested} seat${item.seats_requested > 1 ? 's' : ''} • Rs. ${item.fare}`
                      }
                    </p>
                    {isOffered && item.status === 'active' && (
                      <button
                        onClick={() => handleCancelRide(item.id)}
                        disabled={deletingId === item.id}
                        className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-error bg-error/6 px-2.5 py-1 rounded-full hover:bg-error/12 transition-colors active:scale-95 disabled:opacity-50"
                      >
                        {deletingId === item.id ? (
                          <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-xs">delete</span>
                        )}
                        Cancel Ride
                      </button>
                    )}
                    {!isOffered && (item.status === 'pending' || item.status === 'accepted') && (
                      <button
                        onClick={() => handleCancelRequest(item.id)}
                        disabled={deletingId === item.id}
                        className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-error bg-error/6 px-2.5 py-1 rounded-full hover:bg-error/12 transition-colors active:scale-95 disabled:opacity-50"
                      >
                        {deletingId === item.id ? (
                          <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-xs">close</span>
                        )}
                        Cancel Request
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
