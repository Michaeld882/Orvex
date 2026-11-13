# ORVEX final audit

Scope: five contracts, the app, RPC and transaction handling, dependencies, production build. Network under test: Arc Testnet (5042002). Arc Mainnet (5042) is configured but nothing is deployed there.

## Verdict

Not production-ready for Arc Mainnet. One High finding is an accepted design limitation that needs a product decision first (reputation farming with cooperating wallets), and several verification steps below have not been done. Everything else found was fixed and re-tested.

## Test results (all run in this session)

| Suite | Result |
| --- | --- |
| Solidity (`forge test`, 12 suites, incl. fuzz and invariants) | 241 passed, 0 failed |
| Frontend unit and reliability (`vitest`, 7 files) | 59 passed, 0 failed |
| Page integration against live Arc Testnet contracts (jsdom, 15 tests, fails on any React warning or console error) | 15 passed, 0 failed |
| Lint (oxlint, type-aware) | 0 errors, 0 warnings |
| Typecheck (tsc) | 0 errors |
| Production build (`vite build`) | succeeds |
| Production-style check: built bundle served with `vite preview`, 15 routes | all 200; bundle contains the current testnet addresses, none of the superseded ones, no secrets |
| Slither (all five contracts) | 0 High; see classification |
| Live testnet transactions on the current deployment | 33 real transactions (12 deploy and wiring, 13 seed, 7 lifecycle, 1 through the app's simulate, send and receipt sequence), all receipts status 1; 4 simulated calls reverted with the expected custom error and sent nothing |

Total automated tests: 315 passed, 0 failed.

## Contract findings

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| C1 | Idle disposable wallets could fill every challenge slot | High | Fixed: creator-only `removeParticipant`, permanent per-challenge ban, swap-and-pop list |
| C2 | Placeholder submission bypassed C1 | High | Fixed: removal allowed unless work is Pending or Approved |
| C3 | Creator could cancel a challenge with pending submissions, stranding them | High | Fixed: `cancelChallenge` reverts `HasPendingSubmissions`; `pendingCount` view. Verified live |
| C4 | Project owner could leave a contribution pending forever, locking the contributor's slot | High | Fixed: contributor-only `withdrawContribution` (status Withdrawn). Verified live |
| C5 | Two cooperating wallets can farm reputation (about 34 accept cycles reach 510 points) | High (design) | Accepted risk, mainnet blocker. Self-approval is blocked and points are only for peer-approved work, but a single operator with two wallets passes. A per-pair cap only raises the cost to N wallets. A real fix needs a trust or identity layer (reviewer allowlist, stake, or proof of personhood). Decide before mainnet |
| C6 | Ownership could be renounced before recorders were frozen | Medium | Fixed (earlier round) |
| C7 | Deadline error carried no values | Low | Fixed |
| C8 | `UnknownChallenge`, `InvalidCapacity`, `CooldownActive` carry no context values | Low | Accepted: diagnostics only; the app maps them to messages |
| C9 | Slither `incorrect-equality` on `verifyRecord` | Medium | False positive: compares a bytes32 digest in a view, not a balance or time |
| C10 | Slither `uninitialized-local` on `award` | Medium | False positive: zero is the intended default for kinds without points |
| C11 | Slither `unused-return` on the two `proof.record` calls | Medium | False positive: the id is not needed, and the call reverts on failure |
| C12 | Slither `timestamp` (5) | Low | Accepted: only deadline and cooldown checks, no value at stake |
| C13 | Slither `cyclomatic-complexity` on `record` | Info | Accepted |
| C14 | Deployer still owns Identity and Proof after setup | Info | Accepted: no function remains that the owner can use (setRecorder and finalize revert after freezing; only ownership transfer is left). Recommended: call `renounceOwnership()` after a mainnet deploy |
| C15 | Native or token funds sent by force cannot be recovered | Info | Accepted: no payable functions or receive; nothing reads balances; no sweep means no backdoor |
| C16 | `_joinedIds` keeps ids of challenges a user was removed from | Info | Accepted: join history; the dashboard may list such a challenge |

Reviewed with no finding: reentrancy (state is written before the two trusted, immutable external calls and review functions are `nonReentrant`), overflow (counters saturate, Solidity 0.8 checks), zero addresses, unauthorized changes to verified records (records are append-only and only recorders can write), upgrade paths (none), pause (none), permanent lockout from loops (all views paginated and capped at 50), recorder permissions (frozen on-chain on the testnet deployment, checked by reading `recordersFinalized`), contracts holding funds (none; no payable code).

Deployed code size matches the compiled artifacts. All Solidity files are under 500 lines (largest: `OrvexChallenges.sol`, 352).

## Application and transaction findings

| # | Finding | Status |
| --- | --- | --- |
| A1 | Nested link on Explore (React DOM warning) | Fixed; integration tests now fail on any console error |
| A2 | Creator could review only the first 50 participants of a challenge | Fixed: paginated, 20 per page |
| A3 | Project contributions and updates beyond the newest 50 were invisible, so older pending work could not be reviewed | Fixed: paginated |
| A4 | A slow transaction stayed "pending" forever and never refreshed data | Fixed: keeps checking for 10 minutes with backoff, then says it is still pending and updates itself if it lands |
| A5 | A wallet "cancel" or replacement transaction could be mistaken for success | Fixed: only the same or a repriced transaction counts; cancelled or replaced is a failure |
| A6 | No check of the signing account or the receipt target before reporting success | Fixed |
| A7 | The same action could be submitted twice from different components | Fixed: app-wide guard per account, contract, function and arguments |
| A8 | RPC chain mismatch showed "interactions paused" but did not pause them | Fixed: transactions are blocked on mismatch or when the RPC is down |
| A9 | Switch message always said "Arc Mainnet" | Fixed |
| A10 | An RPC outage on a detail page showed "not found" | Fixed: only a real contract revert shows not found; otherwise an error with Retry |
| A11 | History watcher polled other networks' pending transactions forever | Fixed |
| A12 | Read after write could hit a node that had not seen the block | Fixed: waits for the read node to reach the receipt block before refreshing |
| A13 | 429 and plain wallet rejection objects were not recognised | Fixed |
| A14 | No way for a contributor to withdraw a pending project contribution | Fixed (UI for C4) |
| A15 | Ranges that need `eth_getLogs` | Checked: adaptive chunking halves on failure; works on the testnet RPC |

## RPC reliability (src/lib/rpc.test.ts, scripted JSON-RPC server)

Verified: HTTP 500 and 429 are retried with exponential backoff and recover; a node that stays down gives up after the configured retries and is reported as a network error; a hung RPC times out; JSON-RPC errors are surfaced, not retried blindly; concurrent calls batch into one request; a wrong chain id is detected; an unreachable RPC is never reported as healthy; a stale node is waited out and a node that never catches up is reported. Settings: 3 retries, 400 ms base delay, 12 s timeout.

Transaction state machine (src/lib/txRunner.test.ts): success only after a successful receipt; reverted, cancelled, replaced and wrong-target receipts fail; no receipt in the window stays pending (never confirmed, never failed); wallet rejection is not an error; simulation revert never reaches the wallet; wrong network, rejected switch and account change are handled; duplicates are blocked. These use scripted fakes, so they prove the logic, not the chain. The chain was exercised separately with real testnet transactions.

## Dependency audit (`bun audit`, 37 advisories, 16 high)

Method: built the production bundle with sourcemaps and listed every package that contributes code (92 packages). Checked the 8 advisory packages against it.

| Package | Advisory | In production bundle | Pulled in by | Status |
| --- | --- | --- | --- | --- |
| zod | memory exhaustion on huge collections | No | Circle SDKs, wagmi connectors | Not exploitable in ORVEX: never loaded |
| undici | WebSocket/HTTP parser issues (several high) | No | Circle web SDK (firebase) | Node-only; never loaded |
| @grpc/grpc-js | auth context, error leakage | No | Circle web SDK (firebase) | Never loaded |
| decode-uri-component | DoS on crafted URI | No | WalletConnect utils (query-string) | Not in bundle; ORVEX configures no WalletConnect connector |
| uuid | buffer bounds | No | Circle SDKs, MetaMask SDK | Never loaded |
| toml | prototype pollution, DoS | No | Circle app-kit (anchor) | Never loaded |
| elliptic | risky primitive | No | Node polyfills, Circle SDKs | Never loaded |
| stream-json | prototype pollution, DoS | No | Circle SDKs (solana web3) | Never loaded |

None of them reach the browser bundle, and ORVEX source imports none of the Circle SDKs. They remain in `node_modules` because the project template pre-installs those SDKs. Status: false positive for production impact, accepted as development-environment risk. Action for mainnet: remove the unused Circle packages from `package.json` for the production repository and re-run `bun audit`, which should clear these.

## Application security checks

No secrets or private keys in source or in the built bundle. Environment variables read by the app are public values only. User-supplied onchain text is rendered as text; links are only made clickable for `https` and `ipfs` and open with `noopener noreferrer`. Form input is validated against the same byte limits as the contracts and trimmed before sending. The deployer keystore for the testnet is outside the project, throwaway, and git-ignored.

## Not verified, and remaining risks

1. An in-browser wallet session (extension connect, network switch prompt, signing, rejection) has not been run, because the sandbox has no browser or wallet. The page flows are tested against live data without a wallet, and the same transaction sequence was run with a local key. You should try it once on Arc Testnet.
2. Responsive layout and mobile behaviour were reviewed in code only (no overflow-prone fixed widths found; tabs scroll; drawer navigation on mobile). No device or screenshot testing was done.
3. C5 (reputation farming) is open by design.
4. No independent third-party audit.
5. Mainnet is not deployed and mainnet addresses are not configured.
6. Public testnet RPC limits are unknown; the app retries and backs off but real load has not been measured.
7. The leaderboard reads at most 500 participants and the activity scan is bounded by the deployment block; both say so in the UI.

## Mainnet readiness

Blocked. Required before mainnet: decide and implement the reputation trust model (C5); independent audit; run an in-browser wallet test on testnet; device testing; remove unused template dependencies and re-audit; deploy from your own wallet and renounce ownership afterwards.
