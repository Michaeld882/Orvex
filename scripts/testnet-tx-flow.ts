/**
 * Exercises the same transaction sequence the app uses (chain check, simulate, send, wait for receipt)
 * against the configured Arc Testnet deployment, using a throwaway testnet key from ORVEX_TEST_KEY.
 * Usage: ORVEX_TEST_KEY=0x... bun run scripts/testnet-tx-flow.ts
 */
import { createWalletClient, http, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { ABI_BY_KEY } from '@/abi'
import { ACTIVE_ADDRESSES, ACTIVE_CHAIN, ACTIVE_CHAIN_ID, readClient } from '@/lib/active'
import { describeError } from '@/lib/errors'
import { fetchProfileBundle } from '@/services/reads'

const key = process.env.ORVEX_TEST_KEY as Hex | undefined
if (!key || !ACTIVE_ADDRESSES) throw new Error('ORVEX_TEST_KEY and testnet contract addresses are required')
if (ACTIVE_CHAIN_ID !== 5042002) throw new Error('Refusing to run outside Arc Testnet')

const account = privateKeyToAccount(key)
const wallet = createWalletClient({ account, chain: ACTIVE_CHAIN, transport: http(ACTIVE_CHAIN.rpcUrls.default.http[0]) })

if ((await wallet.getChainId()) !== ACTIVE_CHAIN_ID) throw new Error('wallet chain mismatch')
console.log('1. wallet chain id verified:', await wallet.getChainId(), 'account', account.address)

// 2. A call that must revert: the simulation should surface a readable error and send nothing.
try {
  await readClient.simulateContract({
    account: account.address,
    address: ACTIVE_ADDRESSES.challenges,
    abi: ABI_BY_KEY.challenges,
    functionName: 'joinChallenge',
    args: [1n],
  })
  console.log('2. UNEXPECTED: simulation succeeded')
} catch (e) {
  const d = describeError(e)
  console.log('2. simulation of a bad call reverted as expected ->', d.kind, '|', d.message)
}

// 3. Real transaction: update the profile, simulate first, then wait for the receipt.
const before = await fetchProfileBundle(account.address)
const { request } = await readClient.simulateContract({
  account: account.address,
  address: ACTIVE_ADDRESSES.identity,
  abi: ABI_BY_KEY.identity,
  functionName: 'setProfile',
  args: ['ORVEX Testnet Participant', 'Second seed account used to verify the full contribution flow.', 'Testing', ''],
})
console.log('3. simulation ok, sending')
// The browser wallet signs through its own JSON-RPC account; this script signs locally with the test key.
console.log("   account type", account.type, "request account type", (request as { account?: { type?: string } }).account?.type)
const hash = await wallet.writeContract({ ...request, account })
console.log('   hash', hash, '(pending until receipt)')
const receipt = await readClient.waitForTransactionReceipt({ hash, timeout: 120_000 })
console.log('   receipt status', receipt.status, 'block', receipt.blockNumber.toString())

const after = await fetchProfileBundle(account.address)
console.log('4. profile before:', before.profile.exists, '| after:', after.profile.exists, after.profile.displayName)
if (receipt.status !== 'success' || after.profile.displayName !== 'ORVEX Testnet Participant') process.exit(1)
