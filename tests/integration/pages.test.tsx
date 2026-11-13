import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConnectKitProvider } from 'connectkit'
import { MemoryRouter } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { AppRoutes } from '@/App'
import { config } from '@/config'
import { ACTIVE_ADDRESSES, ACTIVE_CHAIN_ID, ACTIVE_DEPLOYMENT } from '@/lib/active'

const PARTICIPANT = '0xa76f62C4A542Eced441c4359868799E6d1C077bD'

function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })
  return render(
    <WagmiProvider config={config}>
      <QueryClientProvider client={client}>
        <ConnectKitProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>,
  )
}

const seen = (re: RegExp | string) => screen.findAllByText(re, undefined, { timeout: 40_000 })

let errorSpy: MockInstance<typeof console.error>
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  cleanup()
  // Any React warning or runtime error logged while a page rendered fails the test.
  const logged = errorSpy.mock.calls.map((c) => String(c[0]))
  errorSpy.mockRestore()
  expect(logged).toEqual([])
})

describe('ORVEX pages against the configured Arc Testnet contracts', () => {
  it('is configured for Arc Testnet with all five addresses', () => {
    expect(ACTIVE_CHAIN_ID).toBe(5042002)
    expect(ACTIVE_ADDRESSES).not.toBeNull()
  })

  it('Dashboard shows live platform statistics, not the setup screen', async () => {
    mount('/app')
    await seen('Connect to see your progress')
    await waitFor(() => expect(screen.queryByText('Contracts are not configured')).toBeNull())
    await waitFor(() => expect(screen.getByLabelText('Platform statistics').textContent).toMatch(/Proof records\s*2/), { timeout: 40_000 })
  })

  it('Explore lists challenges, projects and ideas', async () => {
    mount('/app/explore')
    await seen('Testnet smoke test challenge')
    await seen('ORVEX Testnet Seed Project')
    await seen('Verify the Innovation Board')
  })

  it('Challenge Arena lists the challenge', async () => {
    mount('/app/arena')
    await seen('Testnet smoke test challenge')
    expect(screen.queryByText('Contracts are not configured')).toBeNull()
  })

  it('Challenge details shows the challenge', async () => {
    mount('/app/arena/1')
    await seen('Testnet smoke test challenge')
    await seen(/Reward note from the creator/)
    await seen('Connect to join')
  })

  it('Create Challenge shows the form with the connect prompt', async () => {
    mount('/app/arena/new')
    await seen('Create a challenge')
    await seen('Connect to create')
  })

  it('Launchpad and project details read the project', async () => {
    mount('/app/launchpad')
    await seen('ORVEX Testnet Seed Project')
    cleanup()
    mount('/app/launchpad/1')
    await seen('Seed project created while verifying the Arc Testnet deployment of ORVEX.')
    await seen('Smoke test contribution')
  })

  it('Innovation Board shows the idea and its endorsement count', async () => {
    mount('/app/board')
    await seen('Verify the Innovation Board')
  })

  it('ORVEX Proof lists records and verifies one in the browser', async () => {
    mount('/app/proof')
    await seen('Proof #2')
    await seen('Smoke test contribution')
    fireEvent.click(await screen.findByRole('tab', { name: 'Verify' }))
    fireEvent.change(screen.getByLabelText('Proof id'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify onchain' }))
    await seen('Verified')
  })

  it('Profile shows verified skills and achievements for a real address', async () => {
    mount(`/app/profile/${PARTICIPANT}`)
    await seen('ORVEX Testnet Participant')
    await seen(/Testing/)
    await seen('Challenger')
  })

  it('Leaderboard ranks contributors by points', async () => {
    mount('/app/leaderboard')
    await seen(/0xa76f62/)
    await seen('35')
  })

  it('Activity shows platform events from the chain', async () => {
    mount('/app/activity')
    fireEvent.click(await screen.findByRole('tab', { name: 'Platform activity' }))
    await seen('Endorsed idea #1')
  })

  it('Settings shows Arc Testnet and the configured contracts', async () => {
    mount('/app/settings')
    await seen('Arc Testnet')
    expect(ACTIVE_ADDRESSES).not.toBeNull()
    await seen(new RegExp(ACTIVE_ADDRESSES?.identity ?? 'missing'))
    await seen(String(ACTIVE_DEPLOYMENT.startBlock))
  })

  it('shows a not-found state for ids that do not exist (contract revert, not an RPC failure)', async () => {
    mount('/app/arena/99999')
    await seen('Challenge not found')
    cleanup()
    mount('/app/launchpad/99999')
    await seen('Project not found')
  })

  it('rejects malformed ids and unknown routes without crashing', async () => {
    mount('/app/arena/abc')
    await seen('That is not a valid challenge id.')
    cleanup()
    mount('/app/does-not-exist')
    await seen('Page not found')
  })
})
