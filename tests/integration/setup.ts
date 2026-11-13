// Browser APIs jsdom does not implement. These are layout shims only; no chain or wallet behaviour is faked.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }),
})
Object.assign(globalThis, { ResizeObserver: NoopObserver, IntersectionObserver: NoopObserver })
window.scrollTo = () => undefined
