/**
 * Which Arc network the app uses. Pure so it can be tested.
 *
 * - Testnet disabled (production default): always Arc Mainnet, whatever is stored in the browser.
 * - Testnet enabled (VITE_ENABLE_TESTNET=true): Arc Testnet unless the user explicitly chose mainnet in Settings.
 */
export type NetworkKind = 'mainnet' | 'testnet'

export function chooseNetwork(testnetEnabled: boolean, stored: string | null): NetworkKind {
  if (!testnetEnabled) return 'mainnet'
  return stored === 'mainnet' ? 'mainnet' : 'testnet'
}
