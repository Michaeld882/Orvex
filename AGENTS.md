# ORVEX

Built with Arc Studio. Decentralized collaboration platform for Arc Mainnet (chain 5042).

## State

- Contracts (Solidity 0.8.28) in `contracts/`: OrvexIdentity, OrvexProof, OrvexChallenges, OrvexLaunchpad, OrvexIdeas. Each file is under 500 lines. Spec in `docs/contract-spec.md`.
- Arc Testnet (5042002): DEPLOYED. Addresses and deployment block are in `docs/deployments/` and in `.env` as `VITE_ORVEX_TESTNET_*` with `VITE_ENABLE_TESTNET=true` (testnet becomes the default network when enabled; Settings can switch back to mainnet).
- Arc Mainnet (5042): NOT deployed. Never invent addresses. The app reads them from `VITE_ORVEX_MAINNET_*` via `src/contracts.config.ts` and shows a setup screen when they are missing.
- Testnet deployer keystore lives outside the project in the sandbox home (`~/.orvex-deployer`). It is a throwaway testnet key and must never be reused on mainnet.
- Mainnet deploys are done by the user from their own wallet (see `docs/DEPLOYMENT.md`).
- Platform deployer wallet must never be used as an owner or recipient in app code.

## Key files

- `src/networks.ts` (mainnet), `src/networks.testnet.ts` (optional, separate), `src/contracts.config.ts`, `src/config.ts`
- `src/abi/generated.ts` is generated: run `bun run abi:gen` after any contract change
- `src/services/reads.ts`, `src/services/activity.ts`, `src/hooks/queries.ts`, `src/hooks/useOrvexTx.ts`
- `src/pages/*` one file per page; routes in `src/App.tsx`
- Validation mirrors contract bounds in `src/lib/validation.ts`

## Rules

- No fake onchain data, hashes or addresses. Show success only after a receipt.
- Reputation points come only from peer-approved work (20 per completed challenge, 15 per accepted contribution).
- Rewards are text notes. Contracts hold no funds.
- Share links: use `buildShareLink` from `src/lib/share.ts`, keep `installShareSync()` in `src/main.tsx`.

## Commands

Reliability tests: `src/lib/rpc.test.ts` (scripted JSON-RPC server) and `src/lib/txRunner.test.ts` (transaction state machine). Live testnet scripts: `scripts/testnet-seed.sh`, `scripts/testnet-lifecycle.sh`, `scripts/testnet-tx-flow.ts`.

`bun run dev`, `bun run check`, `bun run test`, `bun run test:integration` (renders pages against live Arc Testnet data), `bun run build`, `bun run contracts:test`, `bun run scripts/testnet-verify.ts`.
