import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';

export default function NotificationToast() {
  const { showPopup, dismissPopup, handleAcceptFromPopup, handleRejectFromPopup } = useNotifications();
  const navigate = useNavigate();
  const [actionInProgress, setActionInProgress] = useState(null); // 'accept' | 'reject'

  if (!showPopup) return null;

  const handleAccept = async () => {
    setActionInProgress('accept');
    const result = await handleAcceptFromPopup(showPopup);
    setActionInProgress(null);
    if (result.success) {
      navigate(`/active-ride/${showPopup.rideId}`);
    }
  };

  const handleReject = async () => {
    setActionInProgress('reject');
    await handleRejectFromPopup(showPopup);
    setActionInProgress(null);
  };

  const handleViewDetails = () => {
    dismissPopup();
    navigate(`/active-ride/${showPopup.rideId}`);
  };

  const pickupShort = showPopup.pickupAddress?.split(',')[0] || 'Pickup';
  const dropoffShort = showPopup.dropoffAddress?.split(',')[0] || 'Dropoff';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleViewDetails} />

      {/* Popup Card */}
      <div className="relative bg-surface w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up overflow-hidden">
        {/* Accent bar */}
        <div className="h-1 bg-gradient-to-r from-primary to-primary-container" />

        <div className="p-5 pb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-label text-[10px] font-bold uppercase tracking-wider text-primary">
                New Ride Request
              </span>
            </div>
            <button
              onClick={handleViewDetails}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant/50 active:scale-90 transition-transform"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          {/* Passenger Info */}
          <div className="flex items-center gap-3 mb-5">
            {showPopup.passengerAvatar ? (
              <img
                src={showPopup.passengerAvatar}
                alt={showPopup.passengerName}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-surface-container-high"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-headline font-bold text-lg ring-2 ring-surface-container-high">
                {showPopup.passengerName.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-headline font-bold text-base truncate">{showPopup.passengerName}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-0.5 text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-amber-500 text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  {showPopup.passengerRating}
                </span>
                <span className="text-on-surface-variant/30">·</span>
                <span className="text-xs text-on-surface-variant">
                  {showPopup.seatsRequested} seat{showPopup.seatsRequested > 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-headline font-extrabold text-lg text-primary">Rs. {showPopup.fare}</p>
              <p className="text-[9px] text-on-surface-variant/50 font-medium">total fare</p>
            </div>
          </div>

          {/* Route */}
          <div className="bg-surface-container-low rounded-xl p-3.5 mb-5">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center pt-0.5">
                <span className="material-symbols-outlined text-primary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  radio_button_checked
                </span>
                <div className="w-0.5 h-5 bg-outline-variant/30" />
                <span className="material-symbols-outlined text-error text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  location_on
                </span>
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-on-surface-variant/50">Pickup</p>
                  <p className="text-sm font-medium truncate">{pickupShort}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-on-surface-variant/50">Drop-off</p>
                  <p className="text-sm font-medium truncate">{dropoffShort}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Accept / Decline Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleReject}
              disabled={!!actionInProgress}
              className="flex-1 py-3.5 rounded-xl border-2 border-outline-variant/15 text-on-surface-variant font-bold text-sm flex items-center justify-center gap-2 hover:bg-error/5 hover:border-error/20 hover:text-error transition-all active:scale-95 disabled:opacity-50"
            >
              {actionInProgress === 'reject' ? (
                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">close</span>
                  Decline
                </>
              )}
            </button>
            <button
              onClick={handleAccept}
              disabled={!!actionInProgress}
              className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-primary to-primary-container text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:scale-95 disabled:opacity-50"
            >
              {actionInProgress === 'accept' ? (
                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">check</span>
                  Accept
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
