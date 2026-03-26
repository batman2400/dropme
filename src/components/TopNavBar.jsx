import { Link } from 'react-router-dom';

export default function TopNavBar({ showAvatar = false, showNotification = false, showHelp = false, avatarSrc = '' }) {
  return (
    <header className="w-full pt-12 pb-4 flex justify-between items-center px-6 max-w-screen-xl mx-auto bg-surface">
      <div className="flex items-center gap-3">
        {showAvatar && (
          <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-high">
            <img
              alt="User Profile Avatar"
              className="w-full h-full object-cover"
              src={avatarSrc || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDrfrw6-r56stETRjc6ychcPhnBZfo5yZo5L7PXgXrKm5KGUqUFsf0Zb7gAilk0Els15EJQ6JMxFSIjOKVHI6HVOY-GyLviZniC2SWg3wvIc9UlJdvyLeSk7J9U47jnvWcJt6OOXwlptSZPJlsMw4oZSHWXr1v6wruuzYuqSThHSjSG_LHJR3w_Zgzq4_LZ7cuQ6Cs2kTfX9oQBQcccbCjCS9HQopEBjNwO9Q-XpbX09EKJLAMdo0hes1NaTeV-SoWso7-poe7AYHc'}
            />
          </div>
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
