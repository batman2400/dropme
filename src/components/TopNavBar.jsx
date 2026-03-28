import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function TopNavBar({ showAvatar = false, showNotification = false, showHelp = false }) {
  const { profile } = useAuth();
  const avatarUrl = profile?.avatar_url;
  const displayInitial = (profile?.full_name || 'U').charAt(0).toUpperCase();

  return (
    <header className="w-full pt-12 pb-4 flex justify-between items-center px-6 max-w-screen-xl mx-auto bg-surface">
      <div className="flex items-center gap-3">
        {showAvatar && (
          avatarUrl ? (
            <img
              alt="Profile"
              className="w-10 h-10 rounded-full object-cover border-2 border-surface-container-high"
              src={avatarUrl}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white font-bold text-sm">
              {displayInitial}
            </div>
          )
        )}
        <Link to="/dashboard" className="font-headline font-bold tracking-tight text-2xl text-[#0b1c30]">
          dropme.
        </Link>
      </div>
      <div className="flex items-center gap-4">
        {showNotification && (
          <button className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95">
            <span className="material-symbols-outlined">notifications</span>
          </button>
        )}
        {showHelp && (
          <button className="flex items-center gap-2 text-primary font-semibold text-sm hover:opacity-70 transition-opacity">
            <span>Help</span>
            <span className="material-symbols-outlined text-sm">help_outline</span>
          </button>
        )}
      </div>
    </header>
  );
}
