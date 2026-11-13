#!/usr/bin/env bash
# Seeds a fresh Arc Testnet ORVEX deployment with a small, real, labelled data set by sending real
# transactions from two throwaway keystores (see docs/deployments/README.md). Testnet only.
# Usage: ORVEX_DEPLOYER_DIR=$HOME/.orvex-deployer scripts/testnet-seed.sh <identity> <proof> <challenges> <launchpad> <ideas>
set -euo pipefail
D=${ORVEX_DEPLOYER_DIR:-$HOME/.orvex-deployer}
R=${ORVEX_TESTNET_RPC:-https://rpc.testnet.arc.io}
IDN=$1; PR=$2; CH=$3; LP=$4; ID5=$5
K1=$(ls "$D"/keys/*); K2=$(ls "$D"/p2/*)
P2=$(cast wallet address --keystore "$K2" --password-file "$D/pw")

send() {
  local K=$1; shift
  echo "== $2"
  cast send "$@" --keystore "$K" --password-file "$D/pw" --rpc-url "$R" --json |
    python3 -c 'import sys,json; r=json.load(sys.stdin); print(r["transactionHash"], "status", r["status"], "block", int(r["blockNumber"],16))'
}

DL=$(( $(date +%s) + 7*86400 ))
send "$K1" "$IDN" "setProfile(string,string,string,string)" "ORVEX Testnet Seed" "Seed account used to smoke-test the Arc Testnet deployment." "Solidity" ""
send "$K1" "$CH" "createChallenge(string,string,string,string,uint40,uint32)" "Testnet smoke test challenge" "Join, submit a link to your work, and the creator will review it. Created to verify the ORVEX testnet deployment end to end." "Testing" "No reward. Testnet only." "$DL" 10
send "$K1" "$LP" "proposeProject(string,string,string,string,string)" "ORVEX Testnet Seed Project" "A project used to verify the Launchpad flow" "Seed project created while verifying the Arc Testnet deployment of ORVEX." "Testing" "https://explorer.testnet.arc.io"
send "$K1" "$ID5" "postIdea(string,string,string)" "Verify the Innovation Board" "Seed idea posted while verifying the Arc Testnet deployment of ORVEX." "Testing"
send "$K2" "$CH" "joinChallenge(uint64)" 1
send "$K2" "$CH" "submitWork(uint64,string,string)" 1 "https://explorer.testnet.arc.io" "Smoke test submission"
send "$K1" "$CH" "reviewSubmission(uint64,address,bool)" 1 "$P2" true
send "$K2" "$LP" "submitContribution(uint64,string,string)" 1 "Smoke test contribution" "https://explorer.testnet.arc.io"
send "$K1" "$LP" "reviewContribution(uint64,bool)" 1 true
send "$K2" "$PR" "claimAchievement(uint8)" 0
send "$K2" "$PR" "claimAchievement(uint8)" 1
send "$K2" "$ID5" "endorse(uint64)" 1
send "$K2" "$IDN" "setProfile(string,string,string,string)" "ORVEX Testnet Participant" "Second seed account used to verify the full contribution flow." "Testing" ""
echo "seed complete"
