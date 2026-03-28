import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const NotificationContext = createContext({});

export function NotificationProvider({ children }) {
  const { session, profile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showToast, setShowToast] = useState(null); // { message, rideId, type }
  const channelRef = useRef(null);

  // Check if user is a driver (has active rides)
  const [activeRideIds, setActiveRideIds] = useState([]);

  // Fetch driver's active rides on mount
  useEffect(() => {
    if (!session?.user) {
      setActiveRideIds([]);
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const fetchActiveRides = async () => {
      const { data } = await supabase
        .from('rides')
        .select('id')
        .eq('driver_id', session.user.id)
        .in('status', ['active', 'in_progress']);

      if (data) {
        setActiveRideIds(data.map(r => r.id));
      }
    };

    fetchActiveRides();

    // Also listen for new rides this driver creates
    const ridesChannel = supabase
      .channel('driver-rides-global')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rides',
          filter: `driver_id=eq.${session.user.id}`,
        },
        (payload) => {
          setActiveRideIds(prev => [...prev, payload.new.id]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `driver_id=eq.${session.user.id}`,
        },
        (payload) => {
          // Remove ride from active list if completed/cancelled
          if (['completed', 'cancelled'].includes(payload.new.status)) {
            setActiveRideIds(prev => prev.filter(id => id !== payload.new.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ridesChannel);
    };
  }, [session?.user?.id]);

  // Listen for ride_requests on ALL the driver's active rides
  useEffect(() => {
    if (!session?.user || activeRideIds.length === 0) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Subscribe to ride_requests for ALL active rides
    // We use a broader subscription and filter client-side
    const channel = supabase
      .channel('global-ride-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_requests',
        },
        async (payload) => {
          const newRequest = payload.new;

          // Only notify if this request is for one of our rides
          if (!activeRideIds.includes(newRequest.ride_id)) return;

          // Don't notify for our own requests
          if (newRequest.passenger_id === session.user.id) return;

          // Fetch passenger profile for the notification
          const { data: passenger } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', newRequest.passenger_id)
            .single();

          const notification = {
            id: newRequest.id,
            type: 'ride_request',
            rideId: newRequest.ride_id,
            requestId: newRequest.id,
            passengerName: passenger?.full_name || 'Someone',
            passengerAvatar: passenger?.avatar_url,
            seatsRequested: newRequest.seats_requested,
            pickupAddress: newRequest.pickup_address?.split(',')[0] || 'Pickup',
            fare: newRequest.fare,
            createdAt: new Date().toISOString(),
            read: false,
          };

          setNotifications(prev => [notification, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Show toast
          setShowToast({
            message: `${notification.passengerName} requested ${notification.seatsRequested} seat${notification.seatsRequested > 1 ? 's' : ''}`,
            rideId: newRequest.ride_id,
            type: 'ride_request',
          });

          // Auto-dismiss toast after 5 seconds
          setTimeout(() => setShowToast(null), 5000);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [session?.user?.id, activeRideIds]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const dismissToast = useCallback(() => {
    setShowToast(null);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        showToast,
        markAllRead,
        dismissToast,
        activeRideIds,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
