import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import {
  playNotificationSound,
  requestNotificationPermission,
  showBrowserNotification,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
} from '../utils/notifications';

const NotificationContext = createContext({});

export function NotificationProvider({ children }) {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPopup, setShowPopup] = useState(null);
  const [notifPermission, setNotifPermission] = useState('default');
  const channelRef = useRef(null);

  // Active ride IDs for the driver
  const [activeRideIds, setActiveRideIds] = useState([]);

  // ─── Initialize: Service Worker + Push Subscription ────────
  useEffect(() => {
    // Register service worker
    registerServiceWorker();

    // Check notification permission
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // ─── Auto-subscribe to Web Push when logged in + permission granted ──
  useEffect(() => {
    if (!session?.user) return;

    // Only subscribe if permission is already granted
    if ('Notification' in window && Notification.permission === 'granted') {
      subscribeToPush(session.user.id);
    }
  }, [session?.user?.id]);

  // Request permission (call from a user interaction)
  // After permission is granted, immediately subscribes to Web Push
  const requestPermission = useCallback(async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);

    // If user just granted permission, subscribe to push right away
    if (perm === 'granted' && session?.user) {
      subscribeToPush(session.user.id);
    }

    return perm;
  }, [session?.user?.id]);

  // ─── Notify: Sound + Browser Notification + In-App Popup ───
  const notifyDriver = useCallback((notification) => {
    // 1. Play loud chime sound
    playNotificationSound();

    // 2. Show browser-level notification (works when tab not focused)
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotif = showBrowserNotification('🚗 New Ride Request!', {
        body: `${notification.passengerName} wants ${notification.seatsRequested} seat${notification.seatsRequested > 1 ? 's' : ''} — Rs. ${notification.fare}\n${notification.pickupAddress?.split(',')[0]} → ${notification.dropoffAddress?.split(',')[0]}`,
        tag: `ride-request-${notification.requestId}`,
        data: { rideId: notification.rideId },
      });

      // When user clicks the OS notification, focus the app
      if (browserNotif) {
        browserNotif.onclick = () => {
          window.focus();
          browserNotif.close();
        };
      }
    }

    // 3. Show in-app popup
    setShowPopup(notification);
  }, []);

  // ─── Fetch driver's active rides ───────────────────────────
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

    // Listen for new/updated rides
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

    const intervalId = setInterval(fetchActiveRides, 30000); // 30s fetch

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(ridesChannel);
    };
  }, [session?.user?.id]);

  // Use a ref for activeRideIds to avoid reconnecting the websocket unnecessarily
  const activeRideIdsRef = useRef(activeRideIds);
  useEffect(() => {
    activeRideIdsRef.current = activeRideIds;
  }, [activeRideIds]);

  // ─── Auto-fetch pending requests (Fallback Polling) ────────
  useEffect(() => {
    if (!session?.user || activeRideIds.length === 0) return;

    const fetchPendingRequests = async () => {
      try {
        const { data } = await supabase
          .from('ride_requests')
          .select(`
            id, ride_id, passenger_id, seats_requested, pickup_address, dropoff_address, fare, created_at, status,
            passenger:profiles!ride_requests_passenger_id_fkey (
              full_name, avatar_url, rating_avg
            )
          `)
          .in('ride_id', activeRideIds)
          .eq('status', 'pending');

        if (data) {
          data.forEach(req => {
            if (req.passenger_id === session.user.id) return;

            setNotifications(prev => {
              // Check if we already have a notification for this request ID
              const exists = prev.some(n => n.requestId === req.id);
              if (!exists) {
                const notification = {
                  id: req.id,
                  type: 'ride_request',
                  rideId: req.ride_id,
                  requestId: req.id,
                  passengerId: req.passenger_id,
                  passengerName: req.passenger?.full_name || 'Someone',
                  passengerAvatar: req.passenger?.avatar_url,
                  passengerRating: req.passenger?.rating_avg || '5.0',
                  seatsRequested: req.seats_requested,
                  pickupAddress: req.pickup_address || 'Pickup',
                  dropoffAddress: req.dropoff_address || 'Dropoff',
                  fare: req.fare,
                  createdAt: req.created_at,
                  read: false,
                };
                
                // Determine if this is a "new" missed request that should popup
                // If it was created within the last 2 minutes, trigger popup
                const ageMinutes = (new Date() - new Date(req.created_at)) / 60000;
                if (ageMinutes < 2) {
                  notifyDriver(notification);
                }
                
                setUnreadCount(count => count + 1);
                return [notification, ...prev];
              }
              return prev;
            });
          });
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    };

    // Initial check and then every 15 seconds
    fetchPendingRequests();
    const intervalId = setInterval(fetchPendingRequests, 15000);
    return () => clearInterval(intervalId);
  }, [session?.user, activeRideIds, notifyDriver]);

  // ─── Listen for ride requests (realtime) ───────────────────
  useEffect(() => {
    if (!session?.user) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    if (channelRef.current) return; // Already connected

    const channel = supabase
      .channel(`global-ride-notifications-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_requests',
        },
        async (payload) => {
          const newRequest = payload.new;

          // Instead of depending on state, read the latest from the Ref
          if (!activeRideIdsRef.current.includes(newRequest.ride_id)) return;
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

          // 🔔 Trigger ALL notification channels
          notifyDriver(notification);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ride_requests',
        },
        (payload) => {
          const updatedRequest = payload.new;
          
          if (!activeRideIdsRef.current.includes(updatedRequest.ride_id)) return;
          if (updatedRequest.passenger_id === session.user.id) return;

          // If the request is no longer pending (cancelled, rejected, etc.)
          if (updatedRequest.status !== 'pending') {
            // 1. Close the popup if it's currently showing this request
            setShowPopup(prevPopup => {
              if (prevPopup && prevPopup.requestId === updatedRequest.id) {
                return null;
              }
              return prevPopup;
            });

            // 2. Remove from notification list or mark read
            setNotifications(prev => {
              const exists = prev.find(n => n.requestId === updatedRequest.id && !n.read);
              if (exists) {
                setUnreadCount(count => Math.max(0, count - 1));
              }
              // Mark it as read and add a note that it was cancelled
              return prev.map(n => 
                n.requestId === updatedRequest.id 
                  ? { ...n, read: true, isCancelled: updatedRequest.status === 'cancelled' }
                  : n
              );
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [session?.user, notifyDriver]);

  // ─── Accept from popup ─────────────────────────────────────
  const handleAcceptFromPopup = useCallback(async (notification) => {
    try {
      const { data: updatedRows, error: updateErr } = await supabase
        .from('ride_requests')
        .update({ status: 'accepted' })
        .eq('id', notification.requestId)
        .eq('status', 'pending')
        .select();

      if (updateErr) throw updateErr;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('This request was already cancelled or processed.');
      }

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

  // ─── Reject from popup ─────────────────────────────────────
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
        notifPermission,
        markAllRead,
        dismissPopup,
        requestPermission,
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
