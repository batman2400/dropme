import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavBar from '../components/BottomNavBar';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

export default function Profile() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();

  const [ridesCount, setRidesCount] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editName, setEditName] = useState('');
  const [editVehicleType, setEditVehicleType] = useState('car');
  const [editLicensePlate, setEditLicensePlate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const countRides = async () => {
      if (profile.vehicle_type) {
        const { count, error } = await supabase
          .from('rides')
          .select('id', { count: 'exact', head: true })
          .eq('driver_id', profile.id);
        if (!error) setRidesCount(count || 0);
      } else {
        const { count, error } = await supabase
          .from('ride_requests')
          .select('id', { count: 'exact', head: true })
          .eq('passenger_id', profile.id);
        if (!error) setRidesCount(count || 0);
      }
    };
    countRides();
  }, [profile]);

  const handleOpenEdit = () => {
    setEditPhone(profile?.phone_number || '');
    setEditName(profile?.full_name || '');
    setEditVehicleType(profile?.vehicle_type || '');
    setEditLicensePlate(profile?.vehicle_plate || '');
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updateData = {
        phone_number: editPhone,
        full_name: editName,
        vehicle_type: editVehicleType || null,
        vehicle_plate: editLicensePlate || null,
      };
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      setShowEditModal(false);
    } catch (err) {
      console.error('Profile update error:', err);
      alert('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const displayName = profile?.full_name || 'New User';
  const avatarUrl = profile?.avatar_url;
  const isDriver = !!profile?.vehicle_type;

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/4 to-surface pt-safe pb-6 px-5 sm:px-6">
        <div className="content-grid">
          <div className="flex justify-between items-center mb-6 animate-fade-in">
            <h1 className="font-headline font-extrabold tracking-tight text-xl text-on-surface">
              dropme<span className="text-primary">.</span>
            </h1>
            <button className="text-on-surface-variant/50 btn-press p-2 rounded-full">
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </button>
          </div>

          {/* Profile Header */}
          <div className="flex flex-col items-center text-center animate-fade-up">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-20 h-20 rounded-full object-cover ring-4 ring-primary/10 shadow-lg shadow-primary/15 mb-4" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-primary/15 mb-4">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <h2 className="font-headline font-extrabold text-xl tracking-tight text-on-surface mb-1">{displayName}</h2>
            <div className="flex items-center gap-1.5 bg-primary/6 px-3 py-1 rounded-full mb-3">
              <span className="material-symbols-outlined text-primary text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isDriver ? 'verified' : 'person'}
              </span>
              <span className="text-primary font-bold text-[9px] uppercase tracking-[0.12em]">
                {isDriver ? 'Verified Driver' : 'Passenger'}
              </span>
            </div>
            <button
              onClick={handleOpenEdit}
              className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-full font-label text-[10px] font-bold uppercase tracking-[0.08em] btn-press shadow-sm shadow-primary/15"
            >
              <span className="material-symbols-outlined text-[14px]">edit</span>
              Edit Profile
            </button>
          </div>
        </div>
      </div>

      <main className="px-5 sm:px-6 pb-24 content-grid -mt-1">
        {/* Stats */}
        <section className="grid grid-cols-2 gap-2.5 mb-6 animate-fade-up stagger-2">
          <div className="bg-surface-container-lowest rounded-xl p-4 flex flex-col gap-2 border border-outline-variant/6">
            <span className="font-label text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/50">Status</span>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-tertiary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              <span className="font-headline font-bold text-base text-on-surface">Active</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-4 flex flex-col gap-2 border border-outline-variant/6">
            <span className="font-label text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/50">
              {isDriver ? 'Rides Offered' : 'Rides Taken'}
            </span>
            <span className="font-headline font-black text-2xl text-on-surface">{ridesCount}</span>
          </div>
        </section>

        {/* Details */}
        <section className="space-y-1.5 animate-fade-up stagger-3">
          <h3 className="font-headline font-bold text-base px-0.5 mb-2">Details</h3>

          <button onClick={handleOpenEdit} className="w-full bg-surface-container-lowest rounded-xl p-3.5 flex items-center gap-3 border border-outline-variant/6 interactive-card text-left">
            <div className="w-9 h-9 rounded-lg bg-primary/6 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-lg">call</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/50">WhatsApp</p>
              <p className="font-semibold text-on-surface text-sm truncate">{profile?.phone_number || 'Not set'}</p>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant/25 text-base">chevron_right</span>
          </button>

          <button onClick={handleOpenEdit} className="w-full bg-surface-container-lowest rounded-xl p-3.5 flex items-center gap-3 border border-outline-variant/6 interactive-card text-left">
            <div className="w-9 h-9 rounded-lg bg-tertiary/6 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-tertiary text-lg">directions_car</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/50">Vehicle</p>
              <p className="font-semibold text-on-surface text-sm truncate">
                {profile?.vehicle_type || 'Not registered'}{profile?.vehicle_plate ? ` · ${profile.vehicle_plate}` : ''}
              </p>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant/25 text-base">chevron_right</span>
          </button>

          <div className="w-full bg-surface-container-lowest rounded-xl p-3.5 flex items-center gap-3 border border-outline-variant/6 text-left">
            <div className="w-9 h-9 rounded-lg bg-secondary/6 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-secondary text-lg">{isDriver ? 'directions_car' : 'hail'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/50">Account Type</p>
              <p className="font-semibold text-on-surface text-sm capitalize">{isDriver ? 'Driver' : 'Passenger'}</p>
              <p className="text-[9px] text-on-surface-variant/60 font-medium mt-0.5">
                {isDriver ? 'Set vehicle details above' : 'Add vehicle details to become a driver'}
              </p>
            </div>
          </div>
        </section>

        {/* Log Out */}
        <button
          onClick={handleLogout}
          className="w-full mt-8 py-3 rounded-xl border border-error/12 text-error font-semibold text-sm btn-press hover:bg-error/4 transition-colors"
        >
          Log Out
        </button>
      </main>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center animate-fade-in">
          <div className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-headline font-bold text-lg">Edit Profile</h3>
              <button onClick={() => setShowEditModal(false)} className="text-on-surface-variant hover:text-on-surface btn-press p-1 rounded-full">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/50 mb-1.5">Full Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/10 font-medium text-sm" placeholder="Your name" />
              </div>
              <div>
                <label className="block text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/50 mb-1.5">WhatsApp Number</label>
                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/10 font-medium text-sm" placeholder="+94 7X XXX XXXX" />
              </div>
              <div>
                <label className="block text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/50 mb-1.5">Vehicle Type</label>
                <select value={editVehicleType} onChange={(e) => setEditVehicleType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/10 font-medium text-sm">
                  <option value="">None (Passenger)</option>
                  <option value="car">Car</option>
                  <option value="tuk">Tuk-Tuk</option>
                  <option value="bike">Bike</option>
                </select>
                <p className="text-[9px] text-on-surface-variant/45 mt-1">Select a vehicle to enable driver mode.</p>
              </div>
              {editVehicleType && (
                <div className="pt-2 border-t border-outline-variant/8 animate-fade-up">
                  <label className="block text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/50 mb-1.5">Vehicle Plate</label>
                  <input type="text" value={editLicensePlate} onChange={(e) => setEditLicensePlate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/10 font-medium text-sm uppercase" placeholder="ABC-1234" />
                </div>
              )}
            </div>

            <button onClick={handleSaveProfile} disabled={saving}
              className="w-full mt-5 bg-primary text-white font-bold py-3 rounded-full shadow-sm shadow-primary/15 btn-press disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
              {saving ? (
                <><span className="material-symbols-outlined animate-spin text-base">progress_activity</span> Saving...</>
              ) : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      <BottomNavBar activeTab="profile" />
    </div>
  );
}
