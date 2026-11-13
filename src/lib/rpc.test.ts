/**
 * RPC reliability tests against a local scripted JSON-RPC server (so failures can be forced on demand):
 * HTTP 5xx, HTTP 429, hangs, JSON-RPC errors, wrong chain id, batching, stale heads.
 * They exercise the app's real client factory, retry settings and error mapping.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { arcTestnetChain } from '@/networks.testnet'
import { describeError } from './errors'
import { checkRpcHealth, createReadClient, waitForHead } from './rpc'

type Handler = (call: { method: string; params: unknown[] }, attempt: number) => { status?: number; result?: unknown; error?: { code: number; message: string }; hang?: boolean }

let server: Server | undefined
let httpRequests = 0

async function start(handler: Handler): Promise<string> {
  httpRequests = 0
  let attempt = 0
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    httpRequests++
    attempt++
    let body = ''
    req.on('data', (c: Buffer) => (body += c.toString()))
    req.on('end', () => {
      const parsed = JSON.parse(body) as { id: number; method: string; params: unknown[] } | { id: number; method: string; params: unknown[] }[]
      const calls = Array.isArray(parsed) ? parsed : [parsed]
      const answers = calls.map((c) => ({ c, a: handler({ method: c.method, params: c.params }, attempt) }))
      const first = answers[0]?.a
      if (first?.hang) return
      if (first?.status && first.status !== 200) {
        res.writeHead(first.status, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'upstream' }))
        return
      }
      const out = answers.map(({ c, a }) => (a.error ? { jsonrpc: '2.0', id: c.id, error: a.error } : { jsonrpc: '2.0', id: c.id, result: a.result }))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(Array.isArray(parsed) ? out : out[0]))
    })
  })
  await new Promise<void>((r) => server?.listen(0, '127.0.0.1', r))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

afterEach(async () => {
  server?.closeAllConnections()
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()))
  server = undefined
})

const fast = { retryCount: 3, retryDelay: 10, timeout: 400 }
const chainOk: Handler = (c) => (c.method === 'eth_chainId' ? { result: '0x4cef52' } : { result: '0x10' })

describe('RPC retry and backoff', () => {
  it('retries HTTP 500 and succeeds once the node recovers', async () => {
    const url = await start((c, attempt) => (attempt <= 2 ? { status: 500 } : chainOk(c, attempt)))
    const client = createReadClient(arcTestnetChain, url, fast)
    await expect(client.getChainId()).resolves.toBe(5042002)
    expect(httpRequests).toBe(3)
  })

  it('retries HTTP 429 (rate limit) and succeeds', async () => {
    const url = await start((c, attempt) => (attempt <= 2 ? { status: 429 } : chainOk(c, attempt)))
    const client = createReadClient(arcTestnetChain, url, fast)
    await expect(client.getChainId()).resolves.toBe(5042002)
    expect(httpRequests).toBe(3)
  })

  it('gives up after the configured retries when the node stays down, and reports a network error', async () => {
    const url = await start(() => ({ status: 503 }))
    const client = createReadClient(arcTestnetChain, url, fast)
    const err = await client.getChainId().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect(httpRequests).toBe(fast.retryCount + 1)
    expect(describeError(err).kind).toBe('network')
  })

  it('tells the user when the RPC is rate limiting', async () => {
    const url = await start(() => ({ status: 429 }))
    const client = createReadClient(arcTestnetChain, url, { ...fast, retryCount: 1 })
    const err = await client.getChainId().catch((e: unknown) => e)
    expect(describeError(err).message).toMatch(/rate limiting/i)
  })

  it('times out a hung RPC instead of waiting forever', async () => {
    const url = await start(() => ({ hang: true }))
    const client = createReadClient(arcTestnetChain, url, { retryCount: 0, retryDelay: 10, timeout: 150 })
    const started = Date.now()
    const err = await client.getChainId().catch((e: unknown) => e)
    expect(Date.now() - started).toBeLessThan(2_000)
    expect(describeError(err).kind).toBe('network')
  })

  it('does not retry a JSON-RPC level error and surfaces it', async () => {
    const url = await start(() => ({ error: { code: -32000, message: 'header not found' } }))
    const client = createReadClient(arcTestnetChain, url, fast)
    await expect(client.getBlockNumber()).rejects.toThrow()
    expect(httpRequests).toBeLessThanOrEqual(2)
  })

  it('batches concurrent calls into one HTTP request', async () => {
    const url = await start(chainOk)
    const client = createReadClient(arcTestnetChain, url, fast)
    await Promise.all([client.getChainId(), client.getBlockNumber(), client.getChainId()])
    expect(httpRequests).toBe(1)
  })
})

describe('chain id validation', () => {
  it('accepts the expected chain', async () => {
    const url = await start(chainOk)
    const res = await checkRpcHealth(createReadClient(arcTestnetChain, url, fast), 5042002)
    expect(res.status).toBe('ok')
  })

  it('flags an RPC that answers for a different chain', async () => {
    const url = await start((c) => (c.method === 'eth_chainId' ? { result: '0x1' } : { result: '0x10' }))
    const res = await checkRpcHealth(createReadClient(arcTestnetChain, url, fast), 5042002)
    expect(res).toEqual({ status: 'mismatch', actualChainId: 1 })
  })

  it('reports an unreachable RPC as an error, not as healthy', async () => {
    const url = await start(() => ({ status: 502 }))
    const res = await checkRpcHealth(createReadClient(arcTestnetChain, url, { ...fast, retryCount: 0 }), 5042002)
    expect(res.status).toBe('error')
  })
})

describe('stale RPC responses', () => {
  const noSleep = async () => undefined

  it('waits until the node has reached the receipt block', async () => {
    const heads = [98n, 99n, 99n, 101n]
    let i = 0
    const caught = await waitForHead(async () => heads[Math.min(i++, heads.length - 1)], 100n, noSleep)
    expect(caught).toBe(true)
    expect(i).toBe(4)
  })

  it('returns false when the node never catches up so callers do not trust stale data', async () => {
    expect(await waitForHead(async () => 50n, 100n, noSleep, 5)).toBe(false)
  })

  it('survives transient errors while waiting', async () => {
    let n = 0
    const caught = await waitForHead(
      async () => {
        n++
        if (n < 3) throw new Error('rpc blip')
        return 120n
      },
      100n,
      noSleep,
    )
    expect(caught).toBe(true)
  })
})
