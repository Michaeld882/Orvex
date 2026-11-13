# Frontend integration

## Network and addresses

- `src/networks.ts`: Arc Mainnet (5042, `0x13B2`, `https://rpc.mainnet.arc.io`, `https://explorer.arc.io`, native gas USDC). Values are asserted against the generated registry at startup.
- `src/networks.testnet.ts`: optional Arc Testnet, kept separate and disabled by default.
- `src/contracts.config.ts`: the only place contract addresses are read. They come from `VITE_ORVEX_*` variables and are validated. Missing values mean "not configured", never a default.
- `src/config.ts`: wagmi setup. Ethereum Mainnet is not configured.

## Contracts and ABIs

`bun run abi:gen` writes `src/abi/generated.ts` from the Foundry artifacts. Regenerate it whenever the contracts change.

| Contract | Purpose |
| --- | --- |
| OrvexIdentity | Profiles, reputation points, verified skills, participants |
| OrvexProof | Immutable contribution records and achievement claims |
| OrvexChallenges | Challenge lifecycle, joins, submissions, creator reviews |
| OrvexLaunchpad | Projects, updates, contributions and owner reviews |
| OrvexIdeas | Innovation Board ideas and endorsements |

## Reads

`src/services/reads.ts` reads over the official RPC without a wallet. Lists are newest first and paginated with one count read plus one batched list read. `src/hooks/queries.ts` wraps them with React Query (20 second stale time, no refetch on window focus).

## Writes

`src/hooks/useOrvexTx.ts` runs one transaction at a time:

1. Checks the wallet and that contracts are configured.
2. Switches the wallet to Arc and re-verifies its chain id.
3. Simulates the call, so reverts show readable messages.
4. Sends it and records the real hash.
5. Marks it confirmed or failed only from the onchain receipt.

Wallet rejections reset the form silently. Transactions are listed in Activity from a local record that is re-checked against the RPC after reloads.

## Activity history

`src/services/activity.ts` scans logs backwards from the chain head in bounded chunks and stops at `VITE_ORVEX_MAINNET_START_BLOCK`. Without it, only the most recent 100,000 blocks are scanned. The page says how far it has scanned.

## Verifying proof records

The Verify tab rebuilds a record digest in the browser (`src/lib/digest.ts`) and compares it with the contract.
