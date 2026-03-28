import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const NotificationContext = createContext({});

// Notification sound — base64 encoded short chime (plays without any external file)
const NOTIFICATION_SOUND_URL = 'data:audio/wav;base64,UklGRlYGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTIGAACAgICAgICAgICAgICAgICBgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/v8AAP/+/fz7+vn49/b19PPy8fDv7u3s6+rp6Ofm5eTj4uHg397d3Nva2djX1tXU09LR0M/OzczLysnIx8bFxMPCwcC/vr28u7q5uLe2tbSzsrGwr66trKuqqainpqWko6KhoJ+enZybmpmYl5aVlJOSkZCPjo2Mi4qJiIeGhYSDgoGAgICAgICAgICAgICAgICBgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7+/wAA//79/Pv6+fj39vTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPR0M/OzczLysnIx8bFxMPCwcC/vr28u7q5uLe2tbSzsrCvr66trKuqqainpqWko6KhoJ+enZybmpmYl5aVlJOSkZCPjo2Mi4qJiIeGhYSDgoGAgICAgICAgICAgICAgICAgYGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7+/wAA//79/Pv6+fj39vXz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubi3trW0s7KxsK+ura2sq6qpqKempaSjoqGgn56dnJuamZiXlpWUk5KRkI+OjYyLiomIh4aFhIOCgYCAgICAgICAgICAgICAgA==';

export function NotificationProvider({ children }) {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPopup, setShowPopup] = useState(null); // full request data for popup
  const channelRef = useRef(null);
  const audioRef = useRef(null);

  // Active ride IDs for the driver
  const [activeRideIds, setActiveRideIds] = useState([]);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.volume = 0.6;
  }, []);

  const playSound = useCallback(() => {
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {}); // Ignore if blocked by browser
      }
    } catch {}
  }, []);

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

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

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

          if (!activeRideIds.includes(newRequest.ride_id)) return;
          if (newRequest.passenger_id === session.user.id) return;

          // Fetch passenger profile
          const { data: passenger } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, rating_avg')
            .eq('id', newRequest.passenger_id)
            .single();

          const notification = {
            id: newRequest.id,
            type: 'ride_request',
            rideId: newRequest.ride_id,
            requestId: newRequest.id,
            passengerId: newRequest.passenger_id,
            passengerName: passenger?.full_name || 'Someone',
            passengerAvatar: passenger?.avatar_url,
            passengerRating: passenger?.rating_avg || '5.0',
            seatsRequested: newRequest.seats_requested,
            pickupAddress: newRequest.pickup_address || 'Pickup',
            dropoffAddress: newRequest.dropoff_address || 'Dropoff',
            fare: newRequest.fare,
            createdAt: new Date().toISOString(),
            read: false,
          };

          setNotifications(prev => [notification, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Play notification sound
          playSound();

          // Show rich popup with full details
          setShowPopup(notification);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [session?.user?.id, activeRideIds, playSound]);

  // ─── Accept/Reject from popup ──────────────────────────────
  const handleAcceptFromPopup = useCallback(async (notification) => {
    try {
      // Update ride_request status to accepted
      const { error: updateErr } = await supabase
        .from('ride_requests')
        .update({ status: 'accepted' })
        .eq('id', notification.requestId);

      if (updateErr) throw updateErr;

      // Decrement available seats
      const { error: rpcErr } = await supabase
        .rpc('decrement_seats', {
          ride_id_input: notification.rideId,
          seats_to_remove: notification.seatsRequested,
        });

      if (rpcErr) throw rpcErr;

      setShowPopup(null);
      return { success: true };
    } catch (err) {
      console.error('Accept error:', err);
      return { success: false, error: err.message };
    }
  }, []);

  const handleRejectFromPopup = useCallback(async (notification) => {
    try {
      const { error } = await supabase
        .from('ride_requests')
        .update({ status: 'rejected' })
        .eq('id', notification.requestId);

      if (error) throw error;

      setShowPopup(null);
      return { success: true };
    } catch (err) {
      console.error('Reject error:', err);
      return { success: false, error: err.message };
    }
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const dismissPopup = useCallback(() => {
    setShowPopup(null);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        showPopup,
        markAllRead,
        dismissPopup,
        handleAcceptFromPopup,
        handleRejectFromPopup,
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
