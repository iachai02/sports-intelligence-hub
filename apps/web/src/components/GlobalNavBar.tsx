import { NavLink } from 'react-router-dom';
import { LayoutGrid, BarChart3, Calculator, Zap } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { AuthButton } from './AuthButton';
import { cn } from '../lib/utils';

const NAV_LINKS = [
  { to: '/draft-room', label: 'Draft Room', icon: LayoutGrid },
  { to: '/stats', label: 'Player Stats', icon: BarChart3 },
  { to: '/optimizer', label: 'Optimizer', icon: Calculator },
] as const;

export function GlobalNavBar() {
  return (
    <header className="sticky top-0 z-40 h-12 bg-card border-b border-border">
      <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between">
        {/* Left: Branding */}
        <NavLink to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
            <Zap className="h-4 w-4 text-accent" />
          </div>
          <span className="text-sm font-bold text-foreground hidden sm:inline">
            Sports Intelligence Hub
          </span>
        </NavLink>

        {/* Center: Nav links */}
        <nav className="flex items-center gap-1" role="navigation">
          {NAV_LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'text-accent'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{label}</span>
                  {isActive && (
                    <span className="absolute -bottom-[7px] left-3 right-3 h-0.5 bg-accent rounded-full" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Right: Auth + Theme */}
        <div className="flex items-center gap-2 shrink-0">
          <AuthButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
