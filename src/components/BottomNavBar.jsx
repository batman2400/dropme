import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { key: 'home', icon: 'home', label: 'Home', to: '/dashboard' },
  { key: 'rides', icon: 'directions_car', label: 'My Rides', to: '/ride-matches' },
  { key: 'activity', icon: 'history', label: 'Activity', to: '/activity' },
  { key: 'profile', icon: 'person', label: 'Profile', to: '/profile' },
];

export default function BottomNavBar({ activeTab = 'home' }) {
  return (
    <nav className="fixed bottom-0 left-0 w-full glass-nav rounded-t-[1.5rem] z-50 pb-safe">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive = item.key === activeTab;
          return (
            <Link
              key={item.key}
              to={item.to}
              className={`
                relative flex flex-col items-center justify-center rounded-2xl px-4 py-2 
                transition-all duration-300 ease-out
                ${isActive
                  ? 'text-primary'
                  : 'text-on-surface-variant/50 hover:text-on-surface-variant/80'
                }
              `}
            >
              {/* Active indicator pill */}
              {isActive && (
                <div className="absolute -top-1 w-8 h-1 bg-primary rounded-full animate-scale-in" />
              )}
              <span
                className={`material-symbols-outlined text-[22px] transition-all duration-300 ${isActive ? 'scale-110' : ''}`}
                style={isActive ? { fontVariationSettings: "'FILL' 1, 'wght' 400" } : { fontVariationSettings: "'wght' 300" }}
              >
                {item.icon}
              </span>
              <span className={`font-label text-[9px] font-bold uppercase tracking-[0.12em] mt-0.5 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
