import { Link } from 'react-router-dom';

const navItems = [
  { key: 'home', icon: 'home', label: 'Home', to: '/dashboard' },
  { key: 'search', icon: 'search', label: 'Find Ride', to: '/find-ride' },
  { key: 'activity', icon: 'history', label: 'My Rides', to: '/activity' },
  { key: 'profile', icon: 'person', label: 'Profile', to: '/profile' },
];

export default function BottomNavBar({ activeTab = 'home' }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-nav z-50 pb-safe">
      <div className="flex justify-around items-center h-[3.75rem] max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = item.key === activeTab;
          return (
            <Link
              key={item.key}
              to={item.to}
              className={`
                relative flex flex-col items-center justify-center gap-0.5
                min-w-[4rem] py-1.5
                transition-all duration-200 ease-out
                ${isActive
                  ? 'text-primary'
                  : 'text-on-surface-variant/45 active:text-on-surface-variant/70'
                }
              `}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute -top-0.5 w-6 h-[3px] bg-primary rounded-full animate-scale-in" />
              )}
              <span
                className={`material-symbols-outlined transition-all duration-200 ${isActive ? 'text-[22px]' : 'text-[21px]'}`}
                style={isActive
                  ? { fontVariationSettings: "'FILL' 1, 'wght' 500, 'opsz' 24" }
                  : { fontVariationSettings: "'FILL' 0, 'wght' 300, 'opsz' 24" }
                }
              >
                {item.icon}
              </span>
              <span className={`
                font-label text-[9px] font-semibold uppercase tracking-[0.06em] leading-none
                transition-all duration-200
                ${isActive ? 'opacity-100 font-bold' : 'opacity-60'}
              `}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
