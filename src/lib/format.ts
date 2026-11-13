export function shortAddress(address: string, head = 6, tail = 4): string {
  if (address.length <= head + tail + 2) return address
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}

/** Turns onchain link text into a safe href. Only https and ipfs links are ever rendered as links. */
export function safeHref(uri: string): string | null {
  if (/^https:\/\/\S+$/.test(uri)) return uri
  if (/^ipfs:\/\/\S+$/.test(uri)) return `https://ipfs.io/ipfs/${uri.slice('ipfs://'.length)}`
  return null
}

export function shortHash(hash: string): string {
  return shortAddress(hash, 8, 6)
}

export function formatDate(sec: number | bigint): string {
  return new Date(Number(sec) * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(sec: number | bigint): string {
  return new Date(Number(sec) * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeLeft(deadlineSec: number | bigint, nowSec = Math.floor(Date.now() / 1000)): string {
  const diff = Number(deadlineSec) - nowSec
  if (diff <= 0) return 'Ended'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (d > 0) return `${d}d ${h}h left`
  if (h > 0) return `${h}h ${m}m left`
  return `${Math.max(m, 1)}m left`
}

export function timeAgo(sec: number | bigint, nowSec = Math.floor(Date.now() / 1000)): string {
  const diff = Math.max(0, nowSec - Number(sec))
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

export function pageCountFor(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

/** Offset/limit for the contract's ascending list, for page `page` of a newest-first view. */
export function newestFirstWindow(total: number, page: number, pageSize: number): { offset: number; limit: number } {
  const end = total - page * pageSize
  if (end <= 0) return { offset: 0, limit: 0 }
  const offset = Math.max(0, end - pageSize)
  return { offset, limit: end - offset }
}
