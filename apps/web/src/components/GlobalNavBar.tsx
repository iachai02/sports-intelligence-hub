import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, BarChart3, Calculator, Zap, Menu, X } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { AuthButton } from './AuthButton';
import { cn } from '../lib/utils';

const NAV_LINKS = [
  { to: '/draft-room', label: 'Draft Room', description: 'Live auction draft assistant', icon: LayoutGrid },
  { to: '/stats', label: 'Player Stats', description: 'Browse and compare NBA stats', icon: BarChart3 },
  { to: '/optimizer', label: 'Optimizer', description: 'Optimal roster with LP solver', icon: Calculator },
] as const;

const sidebarVariants = {
  closed: { x: '-100%', transition: { type: 'spring' as const, stiffness: 400, damping: 40 } },
  open: { x: 0, transition: { type: 'spring' as const, stiffness: 400, damping: 40 } },
};

const backdropVariants = {
  closed: { opacity: 0 },
  open: { opacity: 1 },
};

export function GlobalNavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const close = useCallback(() => setIsOpen(false), []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleBrandClick = () => {
    close();
    navigate('/');
  };

  return (
    <>
      {/* Top bar — slim, persistent */}
      <header className="sticky top-0 z-40 h-12 bg-card border-b border-border">
        <div className="h-full px-3 flex items-center">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <NavLink to="/" className="flex items-center gap-2 ml-2">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-accent" />
            </div>
            <span className="text-sm font-bold text-foreground hidden sm:inline">
              Sports Intelligence Hub
            </span>
          </NavLink>
        </div>
      </header>

      {/* Sidebar overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="sidebar-backdrop"
              variants={backdropVariants}
              initial="closed"
              animate="open"
              exit="closed"
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/50"
              onClick={close}
              aria-hidden="true"
            />

            {/* Sidebar panel */}
            <motion.aside
              key="sidebar-panel"
              variants={sidebarVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="fixed top-0 left-0 z-50 h-full w-72 bg-card border-r border-border flex flex-col shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              {/* Header: Branding + Close */}
              <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
                <button
                  onClick={handleBrandClick}
                  className="flex items-center gap-2.5 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Zap className="h-4.5 w-4.5 text-accent" />
                  </div>
                  <span className="text-sm font-bold text-foreground group-hover:text-accent transition-colors">
                    Sports Intelligence Hub
                  </span>
                </button>
                <button
                  onClick={close}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Nav links */}
              <nav className="flex-1 overflow-y-auto px-3 py-4" role="navigation">
                <ul className="space-y-1">
                  {NAV_LINKS.map(({ to, label, description, icon: Icon }) => (
                    <li key={to}>
                      <NavLink
                        to={to}
                        onClick={close}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group',
                            isActive
                              ? 'bg-accent/10 text-accent'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <div
                              className={cn(
                                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                                isActive ? 'bg-accent/15' : 'bg-muted/60 group-hover:bg-muted',
                              )}
                            >
                              <Icon className="h-[18px] w-[18px]" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-tight">{label}</p>
                              <p
                                className={cn(
                                  'text-xs leading-tight mt-0.5',
                                  isActive ? 'text-accent/70' : 'text-muted-foreground',
                                )}
                              >
                                {description}
                              </p>
                            </div>
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Footer: Auth + Theme */}
              <div className="border-t border-border px-4 py-3 space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <ThemeToggle />
                </div>
                <AuthButton />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
