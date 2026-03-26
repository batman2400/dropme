import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;

    // Count rides for this user
    const countRides = async () => {
      const { count, error } = await supabase
        .from('rides')
        .select('id', { count: 'exact', head: true })
        .eq('driver_id', profile.id);
      if (!error) setRidesCount(count || 0);
    };
    countRides();
  }, [profile]);

  const handleOpenEdit = () => {
    setEditPhone(profile?.phone_number || '');
    setEditName(profile?.full_name || '');
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ phone_number: editPhone, full_name: editName })
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
  const displayPhone = profile?.phone_number || 'Not set';
  const isDriver = profile?.user_type === 'driver';

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen selection:bg-primary/20">
      {/* Top App Bar */}
      <header className="w-full pt-12 pb-4 bg-surface flex justify-between items-center px-6 max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-white font-bold text-lg">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <h1 className="font-headline font-bold tracking-tight text-2xl text-[#0b1c30]">dropme.</h1>
        </div>
        <button className="text-primary-container hover:opacity-80 transition-opacity active:scale-95">
          <span className="material-symbols-outlined">notifications</span>
        </button>
      </header>

      <main className="px-6 pb-32 max-w-screen-xl mx-auto">
        {/* Profile Header Section */}
        <section className="mt-8 mb-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-headline font-extrabold text-3xl tracking-tight text-on-surface">{displayName}</h2>
            <div className="flex items-center gap-1.5 bg-primary-container/10 px-3 py-1 rounded-full border border-primary/10">
              <span
                className="material-symbols-outlined text-primary text-[18px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {isDriver ? 'verified' : 'person'}
              </span>
              <span className="text-primary font-bold text-[11px] uppercase tracking-wider">
                {isDriver ? 'Verified Driver' : 'Passenger'}
              </span>
            </div>
          </div>
          <p className="text-on-surface-variant font-medium">
            {profile?.vehicle_type ? `${profile.vehicle_type} Driver` : 'Ready to share rides'}
          </p>
          <button
            onClick={handleOpenEdit}
            className="mt-4 flex items-center gap-2 bg-primary/10 text-primary px-5 py-2.5 rounded-full font-label text-sm font-bold uppercase tracking-wider hover:bg-primary/20 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            Edit Profile
          </button>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 gap-3 mb-12">
          {/* Community Rating */}
          <div className="bg-surface-container-lowest rounded-[2rem] p-5 flex flex-col justify-between aspect-square border border-outline-variant/10">
            <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Rating
            </span>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <span className="font-headline font-black text-4xl text-on-surface">4.9</span>
                <span
                  className="material-symbols-outlined text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  star
                </span>
              </div>
              <span className="text-[11px] font-medium text-on-surface-variant">
                {isDriver ? 'Top 5% of drivers' : 'Community member'}
              </span>
            </div>
          </div>
          {/* Rides Shared */}
          <div className="bg-surface-container-lowest rounded-[2rem] p-5 flex flex-col justify-between aspect-square border border-outline-variant/10">
            <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Rides Shared
            </span>
            <div>
              <span className="font-headline font-black text-4xl text-on-surface">{ridesCount}</span>
              <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-primary">
                <span>{isDriver ? 'Routes published' : 'Rides taken'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Account Settings & Credentials */}
        <section className="space-y-4">
          <h3 className="font-headline font-bold text-xl px-2 mb-4">Credentials &amp; Contact</h3>
          {/* WhatsApp Card */}
          <div
            onClick={handleOpenEdit}
            className="bg-surface-container-low rounded-[1.5rem] p-5 flex items-center justify-between group cursor-pointer hover:bg-surface-container transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
                <span className="material-symbols-outlined">call</span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  WhatsApp Number
                </p>
                <p className="font-headline font-bold text-on-surface">{displayPhone}</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary transition-colors">
              edit_square
            </span>
          </div>
          {/* Vehicle Card */}
          <div className="bg-surface-container-low rounded-[1.5rem] p-5 flex items-center justify-between group cursor-pointer hover:bg-surface-container transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
                <span className="material-symbols-outlined">directions_car</span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Primary Vehicle
                </p>
                <p className="font-headline font-bold text-on-surface">
                  {profile?.vehicle_type || 'Not registered'}{profile?.license_plate ? ` • ${profile.license_plate}` : ''}
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary transition-colors">
              verified_user
            </span>
          </div>
          {/* Account Type Card */}
          <div className="bg-surface-container-low rounded-[1.5rem] p-5 flex items-center justify-between group cursor-pointer hover:bg-surface-container transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
                <span className="material-symbols-outlined">badge</span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Account Type
                </p>
                <p className="font-headline font-bold text-on-surface capitalize">
                  {profile?.user_type || 'Passenger'}
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary transition-colors">
              chevron_right
            </span>
          </div>
        </section>

        {/* Log Out Button */}
        <button
          onClick={handleLogout}
          className="w-full mt-12 py-4 rounded-full border border-error/20 text-error font-headline font-bold tracking-tight hover:bg-error/5 transition-colors"
        >
          Log Out Account
        </button>
      </main>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-t-3xl sm:rounded-3xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline font-bold text-xl">Edit Profile</h3>
              <button onClick={() => setShowEditModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-medium"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-medium"
                  placeholder="+94 7X XXX XXXX"
                />
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full mt-6 bg-primary text-white font-bold py-4 rounded-full shadow-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      )}

      <BottomNavBar activeTab="profile" />
    </div>
  );
}
