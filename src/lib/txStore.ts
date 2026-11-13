/**
 * Local record of transactions sent from this browser. Every entry is a real hash
 * returned by the wallet; its status only changes after an RPC receipt says so.
 */
import { useSyncExternalStore } from 'react'

export type TxStatus = 'pending' | 'confirmed' | 'failed'

export interface TxRecord {
  hash: `0x${string}`
  label: string
  chainId: number
  from: `0x${string}`
  status: TxStatus
  createdAt: number
  blockNumber?: string
  error?: string
}

const KEY = 'orvex.tx.v1'
const MAX = 100
const listeners = new Set<() => void>()
let cache: TxRecord[] | null = null

function load(): TxRecord[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as TxRecord[]) : []
  } catch {
    return []
  }
}

function snapshot(): TxRecord[] {
  cache ??= load()
  return cache
}

function commit(next: TxRecord[]): void {
  cache = next.slice(0, MAX)
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // storage unavailable: keep the in-memory list
  }
  listeners.forEach((l) => l())
}

export function addTx(record: TxRecord): void {
  commit([record, ...snapshot().filter((t) => t.hash !== record.hash)])
}

export function updateTx(hash: string, patch: Partial<TxRecord>): void {
  commit(snapshot().map((t) => (t.hash === hash ? { ...t, ...patch } : t)))
}

export function clearTxs(): void {
  commit([])
}

export function getTxs(): TxRecord[] {
  return snapshot()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useTxs(): TxRecord[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
