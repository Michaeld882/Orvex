import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Unit tests describe the production default (mainnet, nothing deployed), whatever .env says.
    env: {
      VITE_ENABLE_TESTNET: 'false',
      VITE_ORVEX_MAINNET_IDENTITY: '',
      VITE_ORVEX_MAINNET_PROOF: '',
      VITE_ORVEX_MAINNET_CHALLENGES: '',
      VITE_ORVEX_MAINNET_LAUNCHPAD: '',
      VITE_ORVEX_MAINNET_IDEAS: '',
    },
  },
})
