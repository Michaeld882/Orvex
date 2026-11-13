import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  Compass,
  LayoutDashboard,
  Lightbulb,
  Menu,
  Plus,
  Rocket,
  Settings,
  ShieldCheck,
  Swords,
  Trophy,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTxWatcher } from '@/hooks/useTxWatcher'
import { Logo } from './Logo'
import { NetworkBanners, RpcChip, useRpcHealth } from './NetworkBanner'
import { WalletButton } from './WalletButton'
import { cx } from './ui'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/explore', label: 'Explore', icon: Compass },
  { to: '/app/arena', label: 'Challenge Arena', icon: Swords },
  { to: '/app/launchpad', label: 'Launchpad', icon: Rocket },
  { to: '/app/board', label: 'Innovation Board', icon: Lightbulb },
  { to: '/app/proof', label: 'ORVEX Proof', icon: ShieldCheck },
  { to: '/app/profile', label: 'Identity', icon: UserRound },
  { to: '/app/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/app/activity', label: 'Activity', icon: Activity },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'group flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition',
              isActive ? 'bg-white/[0.08] text-mist-100' : 'text-mist-400 hover:bg-white/[0.04] hover:text-mist-100',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={cx('h-[18px] w-[18px]', isActive ? 'text-volt-400' : 'text-mist-500 group-hover:text-mist-300')} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const rpc = useRpcHealth()
  const location = useLocation()
  useTxWatcher()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-white/[0.06] bg-ink-900/60 p-5 lg:flex">
        <Link to="/" aria-label="ORVEX home" className="px-1 pt-1">
          <Logo showTagline />
        </Link>
        <Link to="/app/arena/new" className="btn-primary w-full">
          <Plus className="h-4 w-4" /> New challenge
        </Link>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <NavList />
        </div>
        <p className="px-2 text-[11px] leading-relaxed text-mist-500">Reputation is earned from peer-reviewed work recorded on Arc. It cannot be bought.</p>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/[0.06] bg-ink-950/80 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-10">
          <button type="button" className="btn-ghost !min-h-[42px] !px-3 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="lg:hidden" aria-label="ORVEX home">
            <Logo size={28} />
          </Link>
          <div className="flex-1" />
          <RpcChip rpc={rpc} />
          <WalletButton />
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pt-10">
          <div className="mb-6 empty:mb-0">
            <NetworkBanners rpc={rpc} />
          </div>
          <div className="animate-in">
            <Outlet />
          </div>
        </main>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-[82%] max-w-xs flex-col gap-5 border-r border-white/10 bg-ink-900 p-5 lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
            >
              <div className="flex items-center justify-between">
                <Logo showTagline />
                <button type="button" className="btn-ghost !min-h-[40px] !px-2.5" onClick={() => setOpen(false)} aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Link to="/app/arena/new" onClick={() => setOpen(false)} className="btn-primary w-full">
                <Plus className="h-4 w-4" /> New challenge
              </Link>
              <div className="flex-1 overflow-y-auto">
                <NavList onNavigate={() => setOpen(false)} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
