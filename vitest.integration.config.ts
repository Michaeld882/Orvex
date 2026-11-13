/**
 * Integration tests: render the real pages in jsdom against the configured Arc Testnet deployment.
 * They read live chain data over the public Arc Testnet RPC. No wallet is connected and nothing is sent.
 * Run with: bun run test:integration   (needs VITE_ENABLE_TESTNET=true and VITE_ORVEX_TESTNET_* in .env)
 */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    define: Object.fromEntries(Object.entries(env).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)])),
    test: {
      environment: 'jsdom',
      include: ['tests/integration/**/*.test.tsx'],
      setupFiles: ['tests/integration/setup.ts'],
      testTimeout: 60_000,
      hookTimeout: 60_000,
    },
  } as never
})
