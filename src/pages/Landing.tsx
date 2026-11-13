import { motion } from 'framer-motion'
import { ArrowRight, Fingerprint, Lightbulb, Rocket, ShieldCheck, Swords, Trophy, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo, LogoMark } from '@/components/Logo'
import { WalletButton } from '@/components/WalletButton'
import { contractsConfigured, usePlatformStats } from '@/hooks/queries'
import { ACTIVE_CHAIN_ID, ACTIVE_NETWORK_NAME } from '@/lib/active'
import { ARC_MAINNET_EXPLORER, ARC_MAINNET_HEX_ID, ARC_MAINNET_ID, ARC_MAINNET_RPC } from '@/networks'

interface Pillar {
  icon: LucideIcon
  title: string
  body: string
  to: string
}

const PILLARS: Pillar[] = [
  { icon: Swords, title: 'Challenge Arena', body: 'Create challenges, join them, submit work. The creator reviews and approves, and approvals become proof.', to: '/app/arena' },
  { icon: Rocket, title: 'Launchpad', body: 'Propose projects, post progress updates, and accept contributions from the community.', to: '/app/launchpad' },
  { icon: Lightbulb, title: 'Innovation Board', body: 'Share ideas in public. Endorsements show which ones the community wants built.', to: '/app/board' },
  { icon: ShieldCheck, title: 'ORVEX Proof', body: 'Every approved contribution is written as an immutable record you can verify yourself.', to: '/app/proof' },
  { icon: Fingerprint, title: 'Skill Passport', body: 'A public identity that lists skills earned through approved work, plus claimable achievements.', to: '/app/profile' },
  { icon: Trophy, title: 'Leaderboard', body: 'Contributors ranked by reputation points earned from peer-reviewed activity only.', to: '/app/leaderboard' },
]

const RULES = [
  { label: 'Challenge completed (approved by creator)', points: '+20' },
  { label: 'Project contribution accepted by owner', points: '+15' },
  { label: 'Creating, joining, posting, endorsing', points: '0, tracked as activity' },
]

function LiveStats() {
  const stats = usePlatformStats()
  if (!contractsConfigured) {
    return <p className="text-sm text-mist-500">Live counts appear here once the ORVEX contracts are configured for {ACTIVE_NETWORK_NAME}.</p>
  }
  const items = [
    ['Challenges', stats.data?.challenges],
    ['Projects', stats.data?.projects],
    ['Ideas', stats.data?.ideas],
    ['Proof records', stats.data?.proofs],
    ['Contributors', stats.data?.participants],
  ] as const
  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="label">{label}</dt>
          <dd className="mt-1 font-display text-3xl font-bold tabular-nums text-mist-100">{value === undefined ? (stats.isError ? '–' : '…') : value.toLocaleString()}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function Landing() {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[640px]" aria-hidden="true" />
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-volt-400/10 blur-[140px]" aria-hidden="true" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <Link to="/app" className="btn-ghost hidden !min-h-[42px] sm:inline-flex">
            Open app
          </Link>
          <WalletButton />
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.25fr_1fr] lg:pb-24">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
            <p className="label mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-mist-300">
              <span className="h-1.5 w-1.5 rounded-full bg-volt-400" aria-hidden="true" /> Built for Arc Mainnet
            </p>
            <h1 className="font-display text-[clamp(2.6rem,7.5vw,5.2rem)] font-bold leading-[0.98] tracking-[-0.045em] text-mist-100">
              Build <span className="text-gradient">Beyond</span> Limits.
            </h1>
            <p className="mt-6 max-w-xl text-base text-mist-400 sm:text-lg">
              ORVEX is where builders find challenges, launch projects, and earn a reputation that is recorded onchain and checkable by anyone. No arbitrary scores. Only verified work.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/app" className="btn-primary">
                Launch ORVEX <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/app/explore" className="btn-ghost">
                Explore the platform
              </Link>
            </div>
          </motion.div>

          <motion.div
            className="relative mx-auto flex aspect-square w-full max-w-[380px] items-center justify-center"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            aria-hidden="true"
          >
            <div className="absolute inset-6 rounded-[2.5rem] border border-white/[0.06] bg-gradient-to-br from-white/[0.05] to-transparent" />
            <div className="absolute inset-0 rounded-full bg-arc-400/10 blur-3xl" />
            <LogoMark size={230} className="relative animate-floaty drop-shadow-[0_0_40px_rgba(200,245,60,0.25)]" />
          </motion.div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="surface p-6 sm:p-8">
            <LiveStats />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <h2 className="font-display text-3xl font-bold tracking-tight text-mist-100 sm:text-4xl">One platform. Six ways to contribute.</h2>
          <p className="mt-3 max-w-2xl text-mist-400">Everything connects to the same record: what you did, who approved it, and when.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p, i) => (
              <motion.div key={p.title} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay: i * 0.05 }}>
                <Link to={p.to} className="surface group flex h-full flex-col gap-3 p-6 transition hover:-translate-y-0.5 hover:border-volt-400/30">
                  <span className="inline-flex w-fit rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-volt-400">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-display text-xl font-semibold text-mist-100">{p.title}</h3>
                  <p className="text-sm text-mist-400">{p.body}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-20 sm:px-6 lg:grid-cols-2">
          <div className="surface p-6 sm:p-8">
            <p className="label text-volt-400">Reputation Engine</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-mist-100 sm:text-3xl">Points only come from other people.</h2>
            <p className="mt-3 text-sm text-mist-400">The rules live in the contract and are the same for everyone. Posting or joining never earns points. Someone else must review and approve your work.</p>
            <ul className="mt-6 divide-y divide-white/[0.06]">
              {RULES.map((r) => (
                <li key={r.label} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="text-mist-300">{r.label}</span>
                  <span className="shrink-0 font-mono text-xs text-volt-300">{r.points}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="surface p-6 sm:p-8">
            <p className="label text-arc-400">Arc network</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-mist-100 sm:text-3xl">Native USDC, one balance.</h2>
            <p className="mt-3 text-sm text-mist-400">On Arc, gas is paid in USDC. ORVEX moves no funds: challenge rewards are descriptive notes, and contracts accept no payments.</p>
            <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
              <dt className="text-mist-500">Network</dt>
              <dd className="text-mist-100">Arc Mainnet</dd>
              <dt className="text-mist-500">Chain ID</dt>
              <dd className="font-mono text-mist-100">
                {ARC_MAINNET_ID} ({ARC_MAINNET_HEX_ID})
              </dd>
              <dt className="text-mist-500">RPC</dt>
              <dd className="break-all font-mono text-xs text-mist-300">{ARC_MAINNET_RPC}</dd>
              <dt className="text-mist-500">Explorer</dt>
              <dd className="break-all font-mono text-xs text-mist-300">{ARC_MAINNET_EXPLORER}</dd>
              <dt className="text-mist-500">This build</dt>
              <dd className="text-mist-100">{ACTIVE_CHAIN_ID === ARC_MAINNET_ID ? 'Production (Arc Mainnet)' : 'Testnet development mode'}</dd>
            </dl>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-mist-500 sm:flex-row sm:px-6">
          <Logo size={24} showTagline />
          <p>Rewards are notes, not payments. Always verify records onchain.</p>
        </div>
      </footer>
    </div>
  )
}
