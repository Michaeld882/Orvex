# Deploying ORVEX

Arc Studio does not deploy to mainnet. You deploy from your own wallet and review everything first.

Transactions on mainnet use real funds and are irreversible. Use Arc Testnet first, get an independent professional audit, and check every address and setting before you continue.

## 1. Build and test

```bash
bun run contracts:build
bun run contracts:test
```

## 2. Deploy

`contracts/script/DeployOrvex.s.sol` deploys all five contracts, wires the recorder permissions, and then freezes them permanently. It only runs on chain 5042 (Arc Mainnet) or 5042002 (Arc Testnet). It contains no key.

Use an encrypted Foundry keystore rather than a key on the command line:

```bash
cast wallet import orvex-deployer --interactive
forge script contracts/script/DeployOrvex.s.sol:DeployOrvex \
  --rpc-url https://rpc.mainnet.arc.io \
  --account orvex-deployer \
  --broadcast
```

The script logs the five addresses. Note the block number of the first deployment transaction.

Gas on Arc is paid in USDC, so the deployer wallet needs a USDC balance on Arc.

After deployment, `OrvexIdentity` and `OrvexProof` stay owned by the deployer, but their recorder lists are frozen, so the owner has no remaining power over them. You may call `renounceOwnership()` on both (it only works once the lists are frozen).

## 3. Configure the app

Set these in `.env` (or your host's environment) and rebuild:

```
VITE_ORVEX_MAINNET_IDENTITY=0x...
VITE_ORVEX_MAINNET_PROOF=0x...
VITE_ORVEX_MAINNET_CHALLENGES=0x...
VITE_ORVEX_MAINNET_LAUNCHPAD=0x...
VITE_ORVEX_MAINNET_IDEAS=0x...
VITE_ORVEX_MAINNET_START_BLOCK=<deployment block>
```

Restart the dev server after changing `.env`. Addresses are validated at startup; an incomplete or malformed set keeps the app in its "not configured" state.

## 4. Verify

Open Settings in the app. It lists each configured contract with an explorer link, the active chain id (5042) and the RPC status. Compare the addresses with your deployment output.

## Arc Testnet deployment

A testnet deployment already exists. See `docs/deployments/README.md`. Redeploy with the same script and `--rpc-url https://rpc.testnet.arc.io`.

## Optional: testnet

Set `VITE_ENABLE_TESTNET=true` and the `VITE_ORVEX_TESTNET_*` values. The testnet configuration lives in `src/networks.testnet.ts` and is only used when enabled. When enabled, testnet is the default network and Settings can switch back to mainnet.
