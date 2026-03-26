import { Link } from 'react-router-dom';

const navItems = [
  { key: 'home', icon: 'home', label: 'Home', to: '/dashboard' },
  { key: 'rides', icon: 'directions_car', label: 'My Rides', to: '/ride-matches' },
  { key: 'activity', icon: 'history', label: 'Activity', to: '/activity' },
  { key: 'profile', icon: 'person', label: 'Profile', to: '/profile' },
];

export default function BottomNavBar({ activeTab = 'home' }) {
  return (
    <nav className="fixed bottom-0 left-0 w-full h-20 flex justify-around items-center px-4 pb-safe glass-nav rounded-t-[2rem] z-50 shadow-[0_-12px_24px_rgba(11,28,48,0.06)]">
      {navItems.map((item) => {
        const isActive = item.key === activeTab;
        return (
          <Link
            key={item.key}
            to={item.to}
            className={
              isActive
                ? 'flex flex-col items-center justify-center bg-primary-container text-white rounded-full p-3 transition-all duration-300 active:scale-90 tap-highlight-none'
                : 'flex flex-col items-center justify-center text-[#0b1c30]/50 p-3 hover:bg-[#eff4ff] rounded-full transition-all active:scale-90 tap-highlight-none'
            }
          >
            <span
              className="material-symbols-outlined"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
            {!isActive && (
              <span className="font-label text-[10px] font-semibold uppercase tracking-wider mt-1">
                {item.label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
