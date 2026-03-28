import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';

export default function TopNavBar({ showAvatar = false, showNotification = false, showHelp = false }) {
  const { profile } = useAuth();
  const { unreadCount, markAllRead, activeRideIds } = useNotifications();
  const avatarUrl = profile?.avatar_url;
  const displayInitial = (profile?.full_name || 'U').charAt(0).toUpperCase();

  return (
    <header className="w-full pt-safe pb-3 flex justify-between items-center px-5 sm:px-6 content-grid bg-surface/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center gap-2.5">
        {showAvatar && (
          avatarUrl ? (
            <img
              alt="Profile"
              className="w-9 h-9 rounded-full object-cover ring-2 ring-surface-container-high"
              src={avatarUrl}
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {displayInitial}
            </div>
          )
        )}
        <Link to="/dashboard" className="font-headline font-extrabold tracking-tight text-xl text-on-surface">
          dropme<span className="text-primary">.</span>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        {showNotification && (
          <Link
            to={activeRideIds.length > 0 ? `/active-ride/${activeRideIds[0]}` : '/activity'}
            onClick={markAllRead}
            className="relative w-9 h-9 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant/60 hover:text-on-surface-variant transition-colors active:scale-95"
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
          </Link>
        )}
        {showHelp && (
          <button className="flex items-center gap-1.5 text-primary font-semibold text-xs hover:opacity-70 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">help</span>
          </button>
        )}
      </div>
    </header>
  );
}
