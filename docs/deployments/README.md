# Deployments

## Arc Testnet (chain 5042002), current

Deployed with `contracts/script/DeployOrvex.s.sol` from a throwaway testnet deployer, from the final reviewed source (241 Solidity tests passing). Machine-readable record: `arc-testnet.json`.

| Contract | Address |
| --- | --- |
| OrvexIdentity | 0x20913109dB776f5EA5b3BAedb817F4a6A98bb598 |
| OrvexProof | 0xc89fe6B84e7825Ff3Cf815b054aCDB29acf9a9Da |
| OrvexChallenges | 0x7C227412B77FBBD8e4b796F5C4fb4B99a2A90b08 |
| OrvexLaunchpad | 0x163e75d7c0DC9372a44a93Ae8Aae84C56534Ed75 |
| OrvexIdeas | 0x48D536D8751794414A65577bDA44Fe2155FBe353 |

Deployment block: 72206946. Both recorder allowlists are frozen on-chain. Explorer: https://explorer.testnet.arc.io

The app reads these through `VITE_ENABLE_TESTNET=true` and the `VITE_ORVEX_TESTNET_*` variables.

Seed data (two throwaway accounts, created by `scripts/testnet-seed.sh` and `scripts/testnet-lifecycle.sh`): challenge 1 with an approved submission, challenge 2 cancelled after its pending work was rejected, one project with an accepted and a withdrawn contribution, one idea with an endorsement, two proof records, two claimed achievements and two profiles.

## Arc Testnet, superseded

The first deployment (`arc-testnet.v1.json`, block 72205615) predates the pending-cancel and withdraw fixes. It still exists on-chain but is no longer used by the app.

## Arc Mainnet (chain 5042)

Not deployed. The mainnet configuration is untouched and the `VITE_ORVEX_MAINNET_*` variables are unset.
