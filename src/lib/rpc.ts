/**
 * Arc RPC access with explicit retry, timeout and chain-id verification.
 */
import { createPublicClient, http, type Chain, type PublicClient } from 'viem'

export interface RpcOptions {
  retryCount?: number
  retryDelay?: number
  timeout?: number
}

export const DEFAULT_RPC_OPTIONS = { retryCount: 3, retryDelay: 400, timeout: 12_000 } as const

/**
 * Wallet-independent read client. viem retries HTTP 408/429/5xx and network errors with exponential
 * backoff (retryDelay * 2^attempt), so a 429 is retried after 400ms, 800ms, 1600ms by default.
 * JSON-RPC calls inside the same tick are batched into one HTTP request.
 */
export function createReadClient(chain: Chain, url: string, options: RpcOptions = {}): PublicClient {
  const o = { ...DEFAULT_RPC_OPTIONS, ...options }
  return createPublicClient({
    chain,
    transport: http(url, { batch: true, retryCount: o.retryCount, retryDelay: o.retryDelay, timeout: o.timeout }),
  })
}

export type RpcHealthResult =
  | { status: 'ok'; block: bigint }
  | { status: 'mismatch'; actualChainId: number }
  | { status: 'error'; message: string }

/** Verifies the endpoint answers and is the chain we expect before anything is read or sent. */
export async function checkRpcHealth(client: Pick<PublicClient, 'getChainId' | 'getBlockNumber'>, expectedChainId: number): Promise<RpcHealthResult> {
  try {
    const [chainId, block] = await Promise.all([client.getChainId(), client.getBlockNumber()])
    if (chainId !== expectedChainId) return { status: 'mismatch', actualChainId: chainId }
    return { status: 'ok', block }
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message.split('\n')[0] ?? 'RPC error' : 'RPC error' }
  }
}

/**
 * Waits until the RPC node we read from has reached `blockNumber`. Public RPCs are often several nodes
 * behind a load balancer, so a receipt seen on one node may not yet be visible to the next read.
 * Returns true once caught up, false if it did not within the attempts (callers then simply refetch later).
 */
export async function waitForHead(
  getBlockNumber: () => Promise<bigint>,
  blockNumber: bigint,
  sleep: (ms: number) => Promise<void>,
  attempts = 8,
  delayMs = 500,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      if ((await getBlockNumber()) >= blockNumber) return true
    } catch {
      // transient: try again
    }
    await sleep(delayMs)
  }
  return false
}
