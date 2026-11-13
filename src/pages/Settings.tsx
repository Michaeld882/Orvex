import { ExternalLink, Trash2 } from 'lucide-react'
import type { Address } from 'viem'
import type { OrvexAddresses } from '@/contracts.config'
import { useAccount, useDisconnect } from 'wagmi'
import { toast } from 'sonner'
import { useRpcHealth } from '@/components/NetworkBanner'
import { Badge, PageHeader, Spinner } from '@/components/ui'
import { useNetwork } from '@/hooks/useNetwork'
import { ACTIVE_ADDRESSES, ACTIVE_CHAIN_ID, ACTIVE_DEPLOYMENT, IS_MAINNET, addressUrl, setPreferredNetwork } from '@/lib/active'
import { clearTxs, useTxs } from '@/lib/txStore'
import { ARC_MAINNET_EXPLORER, ARC_MAINNET_HEX_ID, ARC_MAINNET_ID, ARC_MAINNET_RPC } from '@/networks'
import { TESTNET_ENABLED } from '@/networks.testnet'

function contractRows(a: OrvexAddresses): [string, Address][] {
  return [
    ['identity', a.identity],
    ['proof', a.proof],
    ['challenges', a.challenges],
    ['launchpad', a.launchpad],
    ['ideas', a.ideas],
  ]
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-sm text-mist-500">{label}</dt>
      <dd className="min-w-0 break-all text-sm text-mist-100 sm:text-right">{children}</dd>
    </div>
  )
}

export default function Settings() {
  const net = useNetwork()
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const rpc = useRpcHealth()
  const txs = useTxs()

  return (
    <>
      <PageHeader eyebrow="Settings" title="Network and data" description="Check which network ORVEX uses, your wallet connection, and the contracts this build talks to." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-mist-100">Network</h2>
          <dl className="mt-2 divide-y divide-white/[0.06]">
            <Row label="Active network">
              <Badge tone={IS_MAINNET ? 'volt' : 'ion'}>{IS_MAINNET ? 'Arc Mainnet' : 'Arc Testnet'}</Badge>
            </Row>
            <Row label="Chain ID">
              <span className="font-mono">
                {ACTIVE_CHAIN_ID}
                {IS_MAINNET && ` (${ARC_MAINNET_HEX_ID})`}
              </span>
            </Row>
            <Row label="RPC">
              <span className="font-mono text-xs">{IS_MAINNET ? ARC_MAINNET_RPC : 'Arc Testnet public RPC'}</span>
            </Row>
            <Row label="Explorer">
              <a href={ARC_MAINNET_EXPLORER} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ion-400 hover:text-volt-300">
                explorer.arc.io <ExternalLink className="h-3 w-3" />
              </a>
            </Row>
            <Row label="Gas token">USDC (native)</Row>
            <Row label="RPC status">
              {rpc.status === 'loading' ? <Spinner /> : <Badge tone={rpc.status === 'ok' ? 'arc' : 'flare'}>{rpc.status === 'ok' ? `Online, block ${rpc.block?.toString()}` : rpc.status}</Badge>}
            </Row>
          </dl>
        </section>

        <section className="surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-mist-100">Wallet</h2>
          <dl className="mt-2 divide-y divide-white/[0.06]">
            <Row label="Status">
              <Badge tone={net.isConnected ? (net.state === 'correct' ? 'arc' : 'ember') : 'neutral'}>
                {!net.isConnected ? 'Not connected' : net.state === 'correct' ? 'Connected, correct network' : 'Connected, wrong network'}
              </Badge>
            </Row>
            <Row label="Address">{address ? <span className="font-mono text-xs">{address}</span> : 'None'}</Row>
            <Row label="Wallet chain ID">{net.walletChainId ?? 'None'}</Row>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {net.isConnected && net.state === 'wrong' && (
              <button type="button" className="btn-primary" onClick={() => void net.switchToArc()} disabled={net.isSwitching}>
                {net.isSwitching && <Spinner />} Switch to {net.targetName}
              </button>
            )}
            {net.isConnected && (
              <button type="button" className="btn-ghost" onClick={() => disconnect()}>
                Disconnect
              </button>
            )}
          </div>
          {!IS_MAINNET && <p className="mt-3 text-xs text-ember-400">Testnet mode is active for this browser.</p>}
        </section>

        <section className="surface p-5 sm:p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold text-mist-100">Contracts</h2>
          {ACTIVE_ADDRESSES ? (
            <dl className="mt-2 divide-y divide-white/[0.06]">
              {contractRows(ACTIVE_ADDRESSES).map(([name, addr]) => (
                <Row key={name} label={`Orvex ${name}`}>
                  <a href={addressUrl(addr)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-ion-400 hover:text-volt-300">
                    {addr} <ExternalLink className="h-3 w-3" />
                  </a>
                </Row>
              ))}
              <Row label="Deployment block">{ACTIVE_DEPLOYMENT.startBlock?.toString() ?? 'Not set (recent history only)'}</Row>
            </dl>
          ) : (
            <div className="mt-3 text-sm text-mist-400">
              <p>No contract addresses are configured for this network. Missing variables:</p>
              <ul className="mt-2 font-mono text-xs text-mist-300">
                {ACTIVE_DEPLOYMENT.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="surface p-5 sm:p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold text-mist-100">Local data</h2>
          <p className="mt-1 text-sm text-mist-400">
            Your transaction list is stored only in this browser. Clearing it does not affect anything onchain. {txs.length} saved.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-danger"
              disabled={txs.length === 0}
              onClick={() => {
                clearTxs()
                toast.success('Local transaction history cleared')
              }}
            >
              <Trash2 className="h-4 w-4" /> Clear transaction history
            </button>
            {TESTNET_ENABLED && (
              <button type="button" className="btn-ghost" onClick={() => setPreferredNetwork(IS_MAINNET ? 'testnet' : 'mainnet')}>
                Switch app to {IS_MAINNET ? 'Arc Testnet' : `Arc Mainnet (${ARC_MAINNET_ID})`}
              </button>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
