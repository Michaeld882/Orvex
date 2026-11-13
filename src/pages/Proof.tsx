import { BadgeCheck, Lock, ShieldCheck, ShieldX } from 'lucide-react'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ProofCard } from '@/components/cards'
import { RequireContracts } from '@/components/NotConfigured'
import { TxButton, TxPanel } from '@/components/TxUi'
import { Badge, CardSkeletons, EmptyState, ErrorState, Field, PageHeader, Pagination, Skeleton, Tabs } from '@/components/ui'
import { useEligibility, useProfile, useProofPage, useProofRecord, useUserProofs } from '@/hooks/queries'
import { useOrvexTx } from '@/hooks/useOrvexTx'
import { ACTIVE_ADDRESSES, ACTIVE_CHAIN_ID } from '@/lib/active'
import { computeDigest } from '@/lib/digest'
import { ACHIEVEMENTS, achievementProgress } from '@/lib/types'
import { fetchProofRecord, verifyRecordOnchain } from '@/services/reads'

type Tab = 'all' | 'mine' | 'achievements' | 'verify'
const PAGE_SIZE = 12

function Records({ mine }: { mine: boolean }) {
  const { address } = useAccount()
  const [page, setPage] = useState(0)
  const all = useProofPage(page, PAGE_SIZE)
  const own = useUserProofs(address)
  const q = mine ? own : all
  if (mine && !address) return <EmptyState title="Connect your wallet" body="Connect to see the proof records recorded for you." />
  if (q.isLoading) return <CardSkeletons count={6} className="h-48" />
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />
  const items = mine ? (own.data ?? []) : (all.data?.items ?? [])
  if (items.length === 0) {
    return <EmptyState title="No proof records yet" body="Records are created when a creator or project owner approves your work. They cannot be edited or removed." />
  }
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((r) => (
          <ProofCard key={r.id.toString()} record={r} />
        ))}
      </div>
      {!mine && all.data && <Pagination page={page} pageCount={all.data.pageCount} onChange={setPage} />}
    </>
  )
}

function Achievements() {
  const { address } = useAccount()
  const profile = useProfile(address)
  const eligible = useEligibility(address)
  const { state, run, active } = useOrvexTx()
  const [target, setTarget] = useState<number | null>(null)
  if (!address) return <EmptyState title="Connect your wallet" body="Achievements are claimed to your own address once you are eligible." />
  if (profile.isLoading || eligible.isLoading) return <Skeleton className="h-64" />
  if (profile.isError || !profile.data) return <ErrorState onRetry={() => void profile.refetch()} />
  const { stats, achievementMask, proofCount } = profile.data
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {ACHIEVEMENTS.map((a) => {
        const claimed = ((achievementMask >> BigInt(a.id)) & 1n) === 1n
        const ok = eligible.data?.[a.id] === true
        const prog = achievementProgress(a.id, stats, proofCount)
        const pct = Math.min(100, Math.round((prog.current / prog.target) * 100))
        return (
          <div key={a.id} className="surface flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <span className={`rounded-xl border p-2.5 ${claimed ? 'border-volt-400/40 bg-volt-400/10 text-volt-300' : 'border-white/10 bg-white/[0.03] text-mist-500'}`}>
                {claimed ? <BadgeCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              </span>
              {claimed ? <Badge tone="volt">Claimed</Badge> : ok ? <Badge tone="arc">Eligible</Badge> : <Badge>Locked</Badge>}
            </div>
            <h3 className="font-display text-lg font-semibold text-mist-100">{a.name}</h3>
            <p className="text-sm text-mist-400">{a.description}</p>
            <div className="mt-auto">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-gradient-to-r from-volt-400 to-arc-400" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-xs tabular-nums text-mist-500">
                {Math.min(prog.current, prog.target)} / {prog.target}
              </p>
              {!claimed && ok && (
                <TxButton
                  className="mt-3 w-full"
                  busy={active && target === a.id}
                  disabled={active}
                  onClick={() => {
                    setTarget(a.id)
                    void run({ label: `Claim achievement: ${a.name}`, contract: 'proof', functionName: 'claimAchievement', args: [a.id] })
                  }}
                >
                  Claim badge
                </TxButton>
              )}
            </div>
          </div>
        )
      })}
      <div className="sm:col-span-2 xl:col-span-3">
        <TxPanel state={state} />
      </div>
    </div>
  )
}

type VerifyResult = { kind: 'match' } | { kind: 'mismatch'; message: string } | { kind: 'error'; message: string }

function Verify() {
  const [raw, setRaw] = useState('')
  const [submitted, setSubmitted] = useState<bigint | null>(null)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [checking, setChecking] = useState(false)
  const valid = /^\d{1,18}$/.test(raw.trim()) && raw.trim() !== '0'
  const record = useProofRecord(submitted)

  const verify = async () => {
    if (!valid || !ACTIVE_ADDRESSES) return
    const id = BigInt(raw.trim())
    setResult(null)
    setSubmitted(id)
    setChecking(true)
    try {
      const { data } = await record.refetch()
      const rec = data ?? (await fetchProofRecord(id))
      const local = computeDigest(rec, ACTIVE_CHAIN_ID, ACTIVE_ADDRESSES.proof)
      const stored = rec.digest === local
      const onchain = await verifyRecordOnchain(id, local)
      setResult(
        stored && onchain
          ? { kind: 'match' }
          : { kind: 'mismatch', message: 'The digest recomputed in your browser does not match the contract. Do not trust this record.' },
      )
    } catch {
      setResult({ kind: 'error', message: 'No such record, or the RPC could not be reached.' })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="surface space-y-4 p-5 sm:p-7">
        <h2 className="font-display text-lg font-semibold text-mist-100">Verify a record</h2>
        <p className="text-sm text-mist-400">
          Enter a proof id. Your browser rebuilds the record digest from the contributor, attestor, source, title, link, chain id and contract address, then checks it against the
          contract. You do not have to trust this interface.
        </p>
        <Field label="Proof id">
          <input className="input" inputMode="numeric" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="1" />
        </Field>
        <button type="button" className="btn-primary w-full" disabled={!valid || checking} onClick={() => void verify()}>
          {checking ? 'Verifying' : 'Verify onchain'}
        </button>
        {result?.kind === 'match' && record.data && (
          <div role="status" className="flex gap-3 rounded-xl border border-arc-400/30 bg-arc-400/10 p-4 text-sm text-arc-300">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Verified</p>
              <p className="mt-1 text-xs">Record #{record.data.id.toString()} matches its onchain digest.</p>
              <p className="mt-2 break-all font-mono text-[11px] opacity-80">{record.data.digest}</p>
            </div>
          </div>
        )}
        {result && result.kind !== 'match' && (
          <div role="alert" className="flex gap-3 rounded-xl border border-flare-400/30 bg-flare-400/10 p-4 text-sm text-flare-400">
            <ShieldX className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{result.message}</p>
          </div>
        )}
      </div>
      {result?.kind === 'match' && record.data && <ProofCard record={record.data} />}
    </div>
  )
}

function Content() {
  const [tab, setTab] = useState<Tab>('all')
  return (
    <>
      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: 'all', label: 'All records' },
            { id: 'mine', label: 'My proofs' },
            { id: 'achievements', label: 'Achievements' },
            { id: 'verify', label: 'Verify' },
          ]}
        />
      </div>
      {tab === 'all' && <Records mine={false} />}
      {tab === 'mine' && <Records mine />}
      {tab === 'achievements' && <Achievements />}
      {tab === 'verify' && <Verify />}
    </>
  )
}

export default function Proof() {
  return (
    <>
      <PageHeader
        eyebrow="ORVEX Proof"
        title="Contributions you can verify"
        description="Every record was approved by a challenge creator or project owner and written to Arc. Records cannot be edited or deleted by anyone."
      />
      <RequireContracts>
        <Content />
      </RequireContracts>
    </>
  )
}
