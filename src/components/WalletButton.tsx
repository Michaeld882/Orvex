import { ConnectKitButton } from 'connectkit'
import { useAccount, useDisconnect, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { useState } from 'react'
import { Check, ChevronDown, Copy, ExternalLink, LogOut, UserRound, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getUsdc } from '@/onchain-facts'
import { formatUsdc } from '@/onchain-money'
import { ACTIVE_CHAIN_ID, addressUrl } from '@/lib/active'
import { shortAddress } from '@/lib/format'
import { Spinner } from './ui'

const usdc = getUsdc(ACTIVE_CHAIN_ID)

/** One USDC balance, read from the ERC-20 view (the same pool that pays gas on Arc). */
export function useUsdcBalance() {
  const { address } = useAccount()
  return useReadContract({
    address: usdc?.address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ACTIVE_CHAIN_ID,
    query: { enabled: !!address && !!usdc, staleTime: 15_000, refetchOnWindowFocus: false },
  })
}

export function WalletButton() {
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const balance = useUsdcBalance()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show }) => {
        if (!isConnected || !address) {
          return (
            <button type="button" className="btn-primary !min-h-[42px]" onClick={show} disabled={isConnecting}>
              {isConnecting ? <Spinner /> : <Wallet className="h-4 w-4" />}
              <span>{isConnecting ? 'Connecting' : 'Connect wallet'}</span>
            </button>
          )
        }
        return (
          <div className="relative">
            <button
              type="button"
              className="btn-ghost !min-h-[42px] !px-3"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-haspopup="menu"
            >
              <span className="h-2 w-2 rounded-full bg-arc-400" aria-hidden="true" />
              <span className="font-mono text-xs">{shortAddress(address)}</span>
              <ChevronDown className="h-3.5 w-3.5 text-mist-500" />
            </button>
            {open && (
              <>
                <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
                <div role="menu" className="surface absolute right-0 z-40 mt-2 w-64 p-2 shadow-2xl">
                  <div className="px-3 py-2.5">
                    <p className="label">USDC balance</p>
                    <p className="mt-1 font-display text-xl font-bold tabular-nums text-mist-100">
                      {balance.data !== undefined ? formatUsdc(balance.data) : balance.isError ? 'Unavailable' : '…'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-mist-500">Also your gas balance on Arc</p>
                  </div>
                  <div className="my-1 h-px bg-white/[0.06]" />
                  <Link to={`/app/profile/${address}`} onClick={() => setOpen(false)} className="menu-item">
                    <UserRound className="h-4 w-4" /> My profile
                  </Link>
                  <button
                    type="button"
                    className="menu-item w-full"
                    onClick={() => {
                      void navigator.clipboard.writeText(address).then(() => {
                        setCopied(true)
                        window.setTimeout(() => setCopied(false), 1500)
                      })
                    }}
                  >
                    {copied ? <Check className="h-4 w-4 text-arc-400" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy address'}
                  </button>
                  <a href={addressUrl(address)} target="_blank" rel="noopener noreferrer" className="menu-item">
                    <ExternalLink className="h-4 w-4" /> View on explorer
                  </a>
                  <button
                    type="button"
                    className="menu-item w-full text-flare-400"
                    onClick={() => {
                      disconnect()
                      setOpen(false)
                    }}
                  >
                    <LogOut className="h-4 w-4" /> Disconnect
                  </button>
                </div>
              </>
            )}
          </div>
        )
      }}
    </ConnectKitButton.Custom>
  )
}
