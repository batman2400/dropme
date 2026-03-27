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
  const [editUserType, setEditUserType] = useState('passenger');
  const [editVehicleType, setEditVehicleType] = useState('Car');
  const [editLicensePlate, setEditLicensePlate] = useState('');
  const [saving, setSaving] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const countRides = async () => {
      if (profile.user_type === 'driver') {
        const { count, error } = await supabase
          .from('rides')
          .select('id', { count: 'exact', head: true })
          .eq('driver_id', profile.id);
        if (!error) setRidesCount(count || 0);
      } else {
        const { count, error } = await supabase
          .from('requests')
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
    setEditUserType(profile?.user_type || 'passenger');
    setEditVehicleType(profile?.vehicle_type || 'Car');
    setEditLicensePlate(profile?.license_plate || '');
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updateData = {
        phone_number: editPhone,
        full_name: editName,
        user_type: editUserType,
        vehicle_type: editUserType === 'driver' ? editVehicleType : null,
        license_plate: editUserType === 'driver' ? editLicensePlate : null,
      };
      const { error } = await supabase
        .from('users')
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

  const handleQuickRoleSwitch = async () => {
    const newRole = profile?.user_type === 'driver' ? 'passenger' : 'driver';
    if (newRole === 'driver' && !profile?.vehicle_type) {
      setEditPhone(profile?.phone_number || '');
      setEditName(profile?.full_name || '');
      setEditUserType('driver');
      setEditVehicleType('Car');
      setEditLicensePlate('');
      setShowEditModal(true);
      return;
    }
    setSwitchingRole(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ user_type: newRole })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      console.error('Role switch error:', err);
      alert('Failed to switch role.');
    } finally {
      setSwitchingRole(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const displayName = profile?.full_name || 'New User';
  const isDriver = profile?.user_type === 'driver';

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen">
      {/* Gradient Header */}
      <div className="bg-gradient-to-b from-primary/5 to-surface pt-safe pb-6 px-6">
        <div className="content-grid">
          <div className="flex justify-between items-center mb-8 animate-fade-in">
            <h1 className="font-headline font-bold tracking-tight text-2xl text-[#0b1c30]">dropme.</h1>
            <button className="text-on-surface-variant btn-press p-2 rounded-full">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>

          {/* Profile Header */}
          <div className="flex flex-col items-center text-center animate-fade-up">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white font-bold text-2xl shadow-xl shadow-primary/20 mb-4">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <h2 className="font-headline font-extrabold text-2xl tracking-tight text-on-surface mb-1">{displayName}</h2>
            <div className="flex items-center gap-1.5 bg-primary/8 px-3 py-1 rounded-full mb-3">
              <span className="material-symbols-outlined text-primary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isDriver ? 'verified' : 'person'}
              </span>
              <span className="text-primary font-bold text-[10px] uppercase tracking-[0.15em]">
                {isDriver ? 'Verified Driver' : 'Passenger'}
              </span>
            </div>
            <button
              onClick={handleOpenEdit}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-full font-label text-xs font-bold uppercase tracking-[0.12em] btn-press shadow-md shadow-primary/20"
            >
              <span className="material-symbols-outlined text-base">edit</span>
              Edit Profile
            </button>
          </div>
        </div>
      </div>

      <main className="px-6 pb-28 content-grid -mt-2">
        {/* Stats Row */}
        <section className="grid grid-cols-2 gap-3 mb-8 animate-fade-up stagger-2">
          <div className="bg-surface-container-lowest rounded-2xl p-5 flex flex-col gap-3 border border-outline-variant/8 interactive-card">
            <span className="font-label text-[9px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/60">
              Rating
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-headline font-black text-3xl text-on-surface">4.9</span>
              <span className="material-symbols-outlined text-amber-400 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-5 flex flex-col gap-3 border border-outline-variant/8 interactive-card">
            <span className="font-label text-[9px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/60">
              {isDriver ? 'Rides Offered' : 'Rides Taken'}
            </span>
            <span className="font-headline font-black text-3xl text-on-surface">{ridesCount}</span>
          </div>
        </section>

        {/* Settings Cards */}
        <section className="space-y-2 animate-fade-up stagger-3">
          <h3 className="font-headline font-bold text-lg px-1 mb-3">Details</h3>

          {/* WhatsApp */}
          <button onClick={handleOpenEdit} className="w-full bg-surface-container-lowest rounded-2xl p-4 flex items-center gap-4 border border-outline-variant/8 interactive-card text-left">
            <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-xl">call</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/60">WhatsApp</p>
              <p className="font-semibold text-on-surface text-sm truncate">{profile?.phone_number || 'Not set'}</p>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant/30 text-lg">chevron_right</span>
          </button>

          {/* Vehicle */}
          <button onClick={handleOpenEdit} className="w-full bg-surface-container-lowest rounded-2xl p-4 flex items-center gap-4 border border-outline-variant/8 interactive-card text-left">
            <div className="w-10 h-10 rounded-xl bg-tertiary/8 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-tertiary text-xl">directions_car</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/60">Vehicle</p>
              <p className="font-semibold text-on-surface text-sm truncate">
                {profile?.vehicle_type || 'Not registered'}{profile?.license_plate ? ` · ${profile.license_plate}` : ''}
              </p>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant/30 text-lg">chevron_right</span>
          </button>

          {/* Role Switch */}
          <button onClick={handleQuickRoleSwitch} disabled={switchingRole} className="w-full bg-surface-container-lowest rounded-2xl p-4 flex items-center gap-4 border border-outline-variant/8 interactive-card text-left disabled:opacity-60">
            <div className="w-10 h-10 rounded-xl bg-secondary/8 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-secondary text-xl">swap_horiz</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/60">Account Type</p>
              <p className="font-semibold text-on-surface text-sm capitalize">{profile?.user_type || 'Passenger'}</p>
              <p className="text-[10px] text-primary font-semibold mt-0.5">
                Tap to switch to {isDriver ? 'Passenger' : 'Driver'}
              </p>
            </div>
            {switchingRole ? (
              <span className="material-symbols-outlined text-primary animate-spin text-lg">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-on-surface-variant/30 text-lg">chevron_right</span>
            )}
          </button>
        </section>

        {/* Log Out */}
        <button
          onClick={handleLogout}
          className="w-full mt-10 py-3.5 rounded-2xl border border-error/15 text-error font-bold text-sm btn-press hover:bg-error/5 transition-colors"
        >
          Log Out
        </button>
      </main>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center animate-fade-in">
          <div className="bg-surface w-full max-w-md rounded-t-3xl sm:rounded-3xl p-7 shadow-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline font-bold text-xl">Edit Profile</h3>
              <button onClick={() => setShowEditModal(false)} className="text-on-surface-variant hover:text-on-surface btn-press p-1 rounded-full">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/60 mb-2">Full Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/15 font-medium text-sm" placeholder="Your name" />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/60 mb-2">WhatsApp Number</label>
                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/15 font-medium text-sm" placeholder="+94 7X XXX XXXX" />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/60 mb-2">Account Type</label>
                <div className="flex p-1 bg-surface-container-highest/50 rounded-full">
                  <button
                    className={`flex-1 py-2.5 rounded-full font-bold text-sm transition-all duration-300 ${editUserType === 'passenger' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant'}`}
                    type="button" onClick={() => setEditUserType('passenger')}>
                    Passenger
                  </button>
                  <button
                    className={`flex-1 py-2.5 rounded-full font-bold text-sm transition-all duration-300 ${editUserType === 'driver' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant'}`}
                    type="button" onClick={() => setEditUserType('driver')}>
                    Driver
                  </button>
                </div>
              </div>
              {editUserType === 'driver' && (
                <div className="space-y-4 pt-3 border-t border-outline-variant/10 animate-fade-up">
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/60 mb-2">Vehicle Type</label>
                    <select value={editVehicleType} onChange={(e) => setEditVehicleType(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/15 font-medium text-sm">
                      <option>Car</option><option>Three-Wheeler</option><option>Bike</option><option>Van</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/60 mb-2">License Plate</label>
                    <input type="text" value={editLicensePlate} onChange={(e) => setEditLicensePlate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/15 font-medium text-sm uppercase" placeholder="ABC-1234" />
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleSaveProfile} disabled={saving}
              className="w-full mt-6 bg-gradient-to-r from-primary to-primary-container text-white font-bold py-3.5 rounded-full shadow-lg shadow-primary/20 btn-press disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? (
                <><span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> Saving...</>
              ) : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      <BottomNavBar activeTab="profile" />
    </div>
  );
}
