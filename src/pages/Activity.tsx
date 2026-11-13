import { CheckCircle2, CircleAlert, Clock } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { RequireContracts } from '@/components/NotConfigured'
import { Badge, EmptyState, ErrorState, PageHeader, Skeleton, Spinner, Tabs, TxLink } from '@/components/ui'
import { contractsConfigured, useActivity } from '@/hooks/queries'
import { ACTIVE_CHAIN_ID } from '@/lib/active'
import { shortAddress, timeAgo } from '@/lib/format'
import { useTxs } from '@/lib/txStore'

type Tab = 'tx' | 'mine' | 'all'

function Transactions() {
  const { address } = useAccount()
  const all = useTxs()
  const txs = all.filter((t) => t.chainId === ACTIVE_CHAIN_ID && (!address || t.from.toLowerCase() === address.toLowerCase()))
  if (txs.length === 0) {
    return <EmptyState title="No transactions from this browser" body="Transactions you send from ORVEX are listed here with their real hash and status, as reported by the Arc RPC." />
  }
  return (
    <ul className="surface divide-y divide-white/[0.06]">
      {txs.map((t) => (
        <li key={t.hash} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
          <span className="shrink-0">
            {t.status === 'confirmed' ? (
              <CheckCircle2 className="h-5 w-5 text-arc-400" />
            ) : t.status === 'failed' ? (
              <CircleAlert className="h-5 w-5 text-flare-400" />
            ) : (
              <Clock className="h-5 w-5 text-ember-400" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-mist-100">{t.label}</p>
            <p className="text-xs text-mist-500">
              {timeAgo(Math.floor(t.createdAt / 1000))}
              {t.blockNumber ? ` · block ${t.blockNumber}` : ''}
            </p>
          </div>
          <Badge tone={t.status === 'confirmed' ? 'arc' : t.status === 'failed' ? 'flare' : 'ember'}>{t.status}</Badge>
          <TxLink hash={t.hash} />
        </li>
      ))}
    </ul>
  )
}

function Events({ mine }: { mine: boolean }) {
  const { address } = useAccount()
  const q = useActivity(mine ? address : undefined)
  if (mine && !address) return <EmptyState title="Connect your wallet" body="Connect to see onchain activity involving your address." />
  if (q.isLoading) return <Skeleton className="h-72" />
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />
  return (
    <>
      {q.items.length === 0 ? (
        <EmptyState title="No activity found in the scanned range" body={q.hasNextPage ? 'Older blocks have not been scanned yet. Load more below.' : 'Nothing has happened in the scanned range yet.'} />
      ) : (
        <ul className="surface divide-y divide-white/[0.06]">
          {q.items.map((i) => (
            <li key={i.key} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
              <div className="min-w-0 flex-1">
                {i.route ? (
                  <Link to={i.route} className="text-sm text-mist-100 hover:text-volt-300">
                    {i.text}
                  </Link>
                ) : (
                  <p className="text-sm text-mist-100">{i.text}</p>
                )}
                <p className="mt-0.5 text-xs text-mist-500">
                  {i.actors[0] ? shortAddress(i.actors[0]) : ''} · block {i.blockNumber.toString()}
                </p>
              </div>
              <TxLink hash={i.txHash} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex flex-col items-center gap-2 text-center">
        {q.oldestScanned !== undefined && q.floor !== undefined && (
          <p className="text-xs text-mist-500">
            Scanned down to block {q.oldestScanned.toString()}. History starts at block {q.floor.toString()}
            {q.head !== undefined ? `, chain head ${q.head.toString()}` : ''}.
          </p>
        )}
        {q.hasNextPage ? (
          <button type="button" className="btn-ghost" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
            {q.isFetchingNextPage && <Spinner />} Scan older blocks
          </button>
        ) : (
          <p className="text-xs text-mist-500">Reached the start of the scan range.</p>
        )}
      </div>
    </>
  )
}

export default function ActivityPage() {
  const [tab, setTab] = useState<Tab>('tx')
  return (
    <>
      <PageHeader eyebrow="History" title="Activity" description="Your transactions and everything that happened on the ORVEX contracts, read straight from Arc." />
      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: 'tx', label: 'My transactions' },
            { id: 'mine', label: 'My onchain activity' },
            { id: 'all', label: 'Platform activity' },
          ]}
        />
      </div>
      {tab === 'tx' ? (
        <Transactions />
      ) : contractsConfigured ? (
        <Events mine={tab === 'mine'} />
      ) : (
        <RequireContracts>
          <span />
        </RequireContracts>
      )}
    </>
  )
}
