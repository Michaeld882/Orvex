#!/usr/bin/env bash
# Real Arc Testnet checks of the liveness fixes: cancel is blocked while work is pending, and a contributor
# can withdraw a pending project contribution. Sends real transactions from the throwaway test keystores.
# Usage: scripts/testnet-lifecycle.sh <challenges> <launchpad>
set -euo pipefail
D=${ORVEX_DEPLOYER_DIR:-$HOME/.orvex-deployer}
R=${ORVEX_TESTNET_RPC:-https://rpc.testnet.arc.io}
CH=$1; LP=$2
K1=$(ls "$D"/keys/*); K2=$(ls "$D"/p2/*)
OWNER=$(cast wallet address --keystore "$K1" --password-file "$D/pw")
P2=$(cast wallet address --keystore "$K2" --password-file "$D/pw")

send() { local K=$1; shift; cast send "$@" --keystore "$K" --password-file "$D/pw" --rpc-url "$R" --json | python3 -c 'import sys,json; r=json.load(sys.stdin); assert r["status"]=="0x1", r; print("  tx", r["transactionHash"], "status", r["status"], "block", int(r["blockNumber"],16))'; }
expect_revert() { # <from> <selector-signature> cast-call-args...
  local FROM=$1 SIG=$2; shift 2
  local out; out=$(cast call "$@" --from "$FROM" --rpc-url "$R" 2>&1 || true)
  local sel; sel=$(cast sig "$SIG")
  if echo "$out" | grep -qi "${sel#0x}"; then echo "  simulation reverted with $SIG as expected"; else echo "  UNEXPECTED simulation result: $out"; exit 1; fi
}

DL=$(( $(date +%s) + 7*86400 ))
echo "1. create challenge, join, submit (pending)"
send "$K1" "$CH" "createChallenge(string,string,string,string,uint40,uint32)" "Lifecycle check challenge" "Used to verify that cancelling is blocked while work is pending." "Testing" "" "$DL" 5
ID=$(cast call "$CH" "challengeCount()(uint64)" --rpc-url "$R")
send "$K2" "$CH" "joinChallenge(uint64)" "$ID"
send "$K2" "$CH" "submitWork(uint64,string,string)" "$ID" "https://explorer.testnet.arc.io" "lifecycle"
echo "   pendingCount = $(cast call "$CH" "pendingCount(uint64)(uint32)" "$ID" --rpc-url "$R")"

echo "2. cancel must be blocked while a submission is pending"
expect_revert "$OWNER" "HasPendingSubmissions()" "$CH" "cancelChallenge(uint64)" "$ID"

echo "3. reject the pending work, then cancel succeeds"
send "$K1" "$CH" "reviewSubmission(uint64,address,bool)" "$ID" "$P2" false
echo "   pendingCount = $(cast call "$CH" "pendingCount(uint64)(uint32)" "$ID" --rpc-url "$R")"
send "$K1" "$CH" "cancelChallenge(uint64)" "$ID"
echo "   effectiveStatus = $(cast call "$CH" "effectiveStatus(uint64)(uint8)" "$ID" --rpc-url "$R") (2 = Cancelled)"

echo "4. contributor withdraws a pending project contribution"
send "$K2" "$LP" "submitContribution(uint64,string,string)" 1 "Withdraw check" "https://explorer.testnet.arc.io"
CID=$(cast call "$LP" "contributionCount()(uint64)" --rpc-url "$R")
expect_revert "$OWNER" "NotContributor()" "$LP" "withdrawContribution(uint64)" "$CID"
send "$K2" "$LP" "withdrawContribution(uint64)" "$CID"
echo "   contribution status (3 = Withdrawn): $(cast call "$LP" "getContribution(uint64)((uint64,uint64,address,uint8,uint40,uint40,string,string))" "$CID" --rpc-url "$R" | grep -oE ', [0-9], ' | head -1)"
expect_revert "$OWNER" "ContributionNotPending()" "$LP" "reviewContribution(uint64,bool)" "$CID" true
echo "lifecycle checks passed"
