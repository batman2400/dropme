import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';

export default function NotificationToast() {
  const { showToast, dismissToast } = useNotifications();
  const navigate = useNavigate();

  if (!showToast) return null;

  const handleTap = () => {
    dismissToast();
    if (showToast.rideId) {
      navigate(`/active-ride/${showToast.rideId}`);
    }
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-md animate-slide-down">
      <button
        onClick={handleTap}
        className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-2xl px-4 py-3.5 shadow-xl flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
      >
        {/* Icon */}
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            person_raised_hand
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-on-surface truncate">
            New Ride Request!
          </p>
          <p className="text-xs text-on-surface-variant truncate">
            {showToast.message}
          </p>
        </div>

        {/* View CTA */}
        <div className="shrink-0 flex items-center gap-1 text-primary text-xs font-bold">
          View
          <span className="material-symbols-outlined text-sm">chevron_right</span>
        </div>
      </button>

      {/* Dismiss */}
      <button
        onClick={(e) => { e.stopPropagation(); dismissToast(); }}
        className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-surface border border-outline-variant/10 rounded-full flex items-center justify-center shadow-sm"
      >
        <span className="material-symbols-outlined text-on-surface-variant text-sm">close</span>
      </button>
    </div>
  );
}
