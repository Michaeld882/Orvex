# ORVEX

Build Beyond Limits. ORVEX is a collaboration platform for Arc Mainnet where people create challenges, launch projects, share ideas, and build a reputation that comes only from work other people approved. Every approved contribution is written onchain as a record anyone can verify.

Built with [Arc Studio](https://studio.arc.io)

## What you can do

- Challenge Arena: create challenges, join them, submit work, and review submissions.
- Launchpad: propose projects, post progress updates, and accept contributions.
- Innovation Board: share ideas and endorse the ones you want built.
- ORVEX Proof: browse immutable contribution records and verify them in your browser.
- Identity and Skill Passport: a public profile with skills verified by approved work and claimable achievements.
- Leaderboard, Dashboard, Explore, Activity and Settings.

ORVEX never holds or sends funds. Challenge rewards are free-text notes only.

## Tech stack

React 18, Vite, TypeScript, Tailwind CSS, wagmi, viem, ConnectKit, Solidity 0.8.28, OpenZeppelin 5.6.1, Foundry, Vitest.

## Development

Prerequisites: Bun and Foundry.

```bash
bun install
bun run dev            # start the app
bun run build          # production build (vite build)
bun run test           # frontend unit tests
bun run test:integration # renders every page against the configured Arc Testnet contracts (needs testnet env)
bun run contracts:build
bun run contracts:test # Solidity tests
bun run abi:gen        # regenerate src/abi/generated.ts after contract changes
bun run check          # lint and typecheck
```

The app shows a "contracts not configured" screen for any network whose contract addresses are not set. Arc Testnet is deployed and configured for development (see `docs/deployments/README.md`); Arc Mainnet is not deployed. See `docs/DEPLOYMENT.md`.

### Environment variables

All are public build-time values. Never put a private key in any of them.

- `VITE_ORVEX_MAINNET_IDENTITY`, `_PROOF`, `_CHALLENGES`, `_LAUNCHPAD`, `_IDEAS`: deployed contract addresses on Arc Mainnet.
- `VITE_ORVEX_MAINNET_START_BLOCK`: block of the deployment, used to bound activity history.
- `VITE_ENABLE_TESTNET`: set to `true` to enable the separate Arc Testnet configuration (development only).
- `VITE_ORVEX_TESTNET_IDENTITY`, `_PROOF`, `_CHALLENGES`, `_LAUNCHPAD`, `_IDEAS`, `_START_BLOCK`: the same values for Arc Testnet.

## Documentation

- `docs/DEPLOYMENT.md`: deploying the contracts and configuring the app.
- `docs/FRONTEND_INTEGRATION.md`: how the app talks to the contracts.
- `docs/contract-spec.md`: contract specification.
- `docs/final-audit.md`: final audit, test results, findings and mainnet readiness.
- `docs/security-review.md`: contract review history.
