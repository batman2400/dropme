import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function TopNavBar({ showAvatar = false, showNotification = false, showHelp = false }) {
  const { profile } = useAuth();
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
          <button className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant/60 hover:text-on-surface-variant transition-colors active:scale-95">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
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
