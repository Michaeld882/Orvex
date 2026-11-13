// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {OrvexTestBase} from "./Orvex.Base.t.sol";
import {OrvexChallenges} from "../OrvexChallenges.sol";

contract OrvexRemoveParticipantTest is OrvexTestBase {
    event ParticipantRemoved(uint64 indexed id, address indexed participant, address indexed creator);

    uint64 internal id;

    function setUp() public override {
        super.setUp();
        id = _newChallenge(); // creator alice, capacity 10
    }

    function _remove(uint64 cid, address u) internal {
        vm.prank(alice);
        challenges.removeParticipant(cid, u);
    }

    function _list(uint64 cid) internal view returns (address[] memory) {
        return challenges.listParticipants(cid, 0, 50);
    }

    function _contains(address[] memory arr, address a) internal pure returns (bool) {
        for (uint256 i; i < arr.length; ++i) if (arr[i] == a) return true;
        return false;
    }

    // ------------------------------------------------------------ access / reverts

    function test_NonCreatorCannotRemove() public {
        _join(id, bob);
        vm.prank(carol);
        vm.expectRevert(OrvexChallenges.NotCreator.selector);
        challenges.removeParticipant(id, bob);
    }

    function test_ParticipantCannotRemoveThemselves() public {
        _join(id, bob);
        vm.prank(bob);
        vm.expectRevert(OrvexChallenges.NotCreator.selector);
        challenges.removeParticipant(id, bob);
    }

    function test_NotCreatorCheckedBeforeNotParticipant() public {
        vm.prank(carol);
        vm.expectRevert(OrvexChallenges.NotCreator.selector);
        challenges.removeParticipant(id, bob);
    }

    function test_UnknownChallengeReverts() public {
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        challenges.removeParticipant(999, bob);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        challenges.removeParticipant(0, bob);
    }

    function test_RevertsOnCancelledChallenge() public {
        _join(id, bob);
        vm.prank(alice);
        challenges.cancelChallenge(id);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.ChallengeIsCancelled.selector);
        challenges.removeParticipant(id, bob);
    }

    function test_RevertsForNonParticipant() public {
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.NotParticipant.selector);
        challenges.removeParticipant(id, bob);
    }

    function test_RemovingCreatorRevertsNotParticipant() public {
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.NotParticipant.selector);
        challenges.removeParticipant(id, alice);
    }

    function test_RemoveTwiceRevertsNotParticipant() public {
        _join(id, bob);
        _remove(id, bob);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.NotParticipant.selector);
        challenges.removeParticipant(id, bob);
    }

    function test_RevertsForPendingSubmitter() public {
        _join(id, bob);
        _submit(id, bob);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.ParticipantHasSubmitted.selector);
        challenges.removeParticipant(id, bob);
    }

    function test_RevertsForApprovedSubmitter() public {
        _complete(id, bob);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.ParticipantHasSubmitted.selector);
        challenges.removeParticipant(id, bob);
    }

    function test_PendingSubmitterStillMembershipAfterFailedRemoval() public {
        _join(id, bob);
        _submit(id, bob);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.ParticipantHasSubmitted.selector);
        challenges.removeParticipant(id, bob);
        assertTrue(challenges.isParticipant(id, bob));
        assertEq(challenges.getChallenge(id).participants, 1);
    }

    function test_CanRemoveSubmitterAfterRejection() public {
        _join(id, bob);
        _submit(id, bob);
        _review(id, bob, false);
        vm.expectEmit(true, true, true, true, address(challenges));
        emit ParticipantRemoved(id, bob, alice);
        _remove(id, bob);
        assertFalse(challenges.isParticipant(id, bob));
        assertEq(challenges.getChallenge(id).participants, 0);
        assertEq(_list(id).length, 0);
    }

    function test_CreatorCanRejectPlaceholderThenRemove() public {
        _join(id, bob);
        _submit(id, bob); // placeholder submission squatting a slot
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.ParticipantHasSubmitted.selector);
        challenges.removeParticipant(id, bob);
        _review(id, bob, false);
        _remove(id, bob);
        assertFalse(challenges.isParticipant(id, bob));
        assertEq(challenges.getChallenge(id).participants, 0);
    }

    function test_RemovalAfterRejectionFreesCapacity() public {
        uint64 cid = _tryCreate(10, 20, 8, 0, 1 days, 2);
        _join(cid, bob);
        _join(cid, carol);
        _submit(cid, bob);
        _review(cid, bob, false);
        vm.prank(dave);
        vm.expectRevert(OrvexChallenges.ChallengeFull.selector);
        challenges.joinChallenge(cid);

        _remove(cid, bob);
        _join(cid, dave);
        assertEq(challenges.getChallenge(cid).participants, 2);
        assertTrue(challenges.isParticipant(cid, dave));
        assertFalse(challenges.isParticipant(cid, bob));
    }

    function test_RejectedSubmissionRecordReadableAfterRemoval() public {
        _join(id, bob);
        _submit(id, bob);
        OrvexChallenges.Submission memory before_ = challenges.getSubmission(id, bob);
        _review(id, bob, false);
        OrvexChallenges.Submission memory rejected = challenges.getSubmission(id, bob);
        _remove(id, bob);
        OrvexChallenges.Submission memory afterRemoval = challenges.getSubmission(id, bob);
        assertEq(uint8(afterRemoval.status), uint8(OrvexChallenges.SubmissionStatus.Rejected));
        assertEq(afterRemoval.attempts, 1);
        assertEq(afterRemoval.attempts, before_.attempts);
        assertEq(afterRemoval.uri, rejected.uri);
        assertEq(afterRemoval.note, rejected.note);
        assertEq(afterRemoval.submittedAt, rejected.submittedAt);
        assertEq(afterRemoval.reviewedAt, rejected.reviewedAt);
        assertGt(bytes(afterRemoval.uri).length, 0);
    }

    function test_RemovedAfterRejectionCannotResubmitOrRejoin() public {
        _join(id, bob);
        _submit(id, bob);
        _review(id, bob, false);
        _remove(id, bob);
        vm.prank(bob);
        vm.expectRevert(OrvexChallenges.NotParticipant.selector);
        challenges.submitWork(id, "https://x.io/work2", "again");
        vm.prank(bob);
        vm.expectRevert(OrvexChallenges.RemovedByCreator.selector);
        challenges.joinChallenge(id);
        // record unchanged
        assertEq(challenges.getSubmission(id, bob).attempts, 1);
        assertEq(uint8(challenges.getSubmission(id, bob).status), uint8(OrvexChallenges.SubmissionStatus.Rejected));
    }

    function test_ResubmittedAfterRejectionIsPendingAndNotRemovable() public {
        _join(id, bob);
        _submit(id, bob);
        _review(id, bob, false);
        _submit(id, bob); // second attempt -> Pending again
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.ParticipantHasSubmitted.selector);
        challenges.removeParticipant(id, bob);
        assertTrue(challenges.isParticipant(id, bob));
    }

    function test_RemoveRejectedAllowedAfterCloseAndSwapKeepsOthers() public {
        _joinThree();
        _submit(id, bob);
        _review(id, bob, false);
        vm.prank(alice);
        challenges.closeChallenge(id);
        _remove(id, bob);
        address[] memory l = _list(id);
        assertEq(l.length, 2);
        assertTrue(_contains(l, carol));
        assertTrue(_contains(l, dave));
        assertFalse(_contains(l, bob));
    }

    function test_RemoveRejectedRevertsOnCancelledChallenge() public {
        _join(id, bob);
        _submit(id, bob);
        _review(id, bob, false);
        vm.prank(alice);
        challenges.cancelChallenge(id);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.ChallengeIsCancelled.selector);
        challenges.removeParticipant(id, bob);
    }

    function test_RemovedRejectedDoesNotAffectSubmissionCounter() public {
        _join(id, bob);
        _submit(id, bob);
        _review(id, bob, false);
        _remove(id, bob);
        assertEq(challenges.getChallenge(id).submissions, 1);
        assertEq(challenges.getChallenge(id).approved, 0);
    }

    // ------------------------------------------------------------ success path

    function test_RemoveEmitsEvent() public {
        _join(id, bob);
        vm.expectEmit(true, true, true, true, address(challenges));
        emit ParticipantRemoved(id, bob, alice);
        _remove(id, bob);
    }

    function test_RemoveDecrementsParticipantsAndClearsMembership() public {
        _join(id, bob);
        _join(id, carol);
        assertEq(challenges.getChallenge(id).participants, 2);
        _remove(id, bob);
        assertEq(challenges.getChallenge(id).participants, 1);
        assertFalse(challenges.isParticipant(id, bob));
        assertTrue(challenges.isParticipant(id, carol));
    }

    function test_RemoveAllowedAfterClose() public {
        _join(id, bob);
        vm.prank(alice);
        challenges.closeChallenge(id);
        _remove(id, bob);
        assertFalse(challenges.isParticipant(id, bob));
        assertEq(challenges.getChallenge(id).participants, 0);
    }

    function test_RemoveAllowedAfterExpiry() public {
        _join(id, bob);
        vm.warp(block.timestamp + 2 days);
        _remove(id, bob);
        assertFalse(challenges.isParticipant(id, bob));
        assertEq(_list(id).length, 0);
    }

    function test_JoinHistoryIsRetained() public {
        _join(id, bob);
        _remove(id, bob);
        assertEq(challenges.joinedCount(bob), 1);
    }

    // ------------------------------------------------------------ capacity

    function test_RemovalFreesCapacity() public {
        uint64 cid = _tryCreate(10, 20, 8, 0, 1 days, 2);
        _join(cid, bob);
        _join(cid, carol);
        vm.prank(dave);
        vm.expectRevert(OrvexChallenges.ChallengeFull.selector);
        challenges.joinChallenge(cid);

        _remove(cid, bob);
        _join(cid, dave);
        assertEq(challenges.getChallenge(cid).participants, 2);
        assertTrue(challenges.isParticipant(cid, dave));
    }

    // ------------------------------------------------------------ swap-and-pop list consistency

    function _joinThree() internal {
        _join(id, bob);
        _join(id, carol);
        _join(id, dave);
    }

    function test_RemoveFirstSwapsLastIntoSlot() public {
        _joinThree();
        _remove(id, bob);
        address[] memory l = _list(id);
        assertEq(l.length, 2);
        assertEq(l[0], dave);
        assertEq(l[1], carol);
    }

    function test_RemoveMiddlePreservesOthers() public {
        _joinThree();
        _remove(id, carol);
        address[] memory l = _list(id);
        assertEq(l.length, 2);
        assertEq(l[0], bob);
        assertEq(l[1], dave);
    }

    function test_RemoveLastJustPops() public {
        _joinThree();
        _remove(id, dave);
        address[] memory l = _list(id);
        assertEq(l.length, 2);
        assertEq(l[0], bob);
        assertEq(l[1], carol);
    }

    function test_RemoveOnlyParticipantEmptiesList() public {
        _join(id, bob);
        _remove(id, bob);
        assertEq(_list(id).length, 0);
        assertEq(challenges.getChallenge(id).participants, 0);
    }

    function test_SuccessiveRemovalsKeepIndexMapConsistent() public {
        _joinThree();
        _remove(id, bob); // list: dave, carol
        _remove(id, dave); // list: carol (dave was at index 0, carol swapped in)
        address[] memory l = _list(id);
        assertEq(l.length, 1);
        assertEq(l[0], carol);
        _remove(id, carol);
        assertEq(_list(id).length, 0);
        assertEq(challenges.getChallenge(id).participants, 0);
    }

    function test_SwappedParticipantCanStillSubmitAndBeReviewed() public {
        _joinThree();
        _remove(id, bob); // dave swapped to index 0
        _submit(id, dave);
        _review(id, dave, true);
        assertEq(challenges.getChallenge(id).approved, 1);
        // dave has submitted, so cannot be removed any more
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.ParticipantHasSubmitted.selector);
        challenges.removeParticipant(id, dave);
    }

    // ------------------------------------------------------------ post-removal behaviour

    function test_RemovedCannotRejoin() public {
        _join(id, bob);
        _remove(id, bob);
        vm.prank(bob);
        vm.expectRevert(OrvexChallenges.RemovedByCreator.selector);
        challenges.joinChallenge(id);
    }

    function test_RemovedCheckedBeforeCapacity() public {
        uint64 cid = _tryCreate(10, 20, 8, 0, 1 days, 1);
        _join(cid, bob);
        _remove(cid, bob);
        _join(cid, carol); // now full
        vm.prank(bob);
        vm.expectRevert(OrvexChallenges.RemovedByCreator.selector);
        challenges.joinChallenge(cid);
    }

    function test_RemovalIsPerChallenge() public {
        uint64 other = _newChallenge();
        _join(id, bob);
        _remove(id, bob);
        _join(other, bob);
        assertTrue(challenges.isParticipant(other, bob));
        assertFalse(challenges.isParticipant(id, bob));
    }

    function test_RemovedCannotSubmit() public {
        _join(id, bob);
        _remove(id, bob);
        vm.prank(bob);
        vm.expectRevert(OrvexChallenges.NotParticipant.selector);
        challenges.submitWork(id, "https://x.io/work", "n");
    }

    function test_CreatorCanStillReviewOthersAfterRemoval() public {
        _join(id, bob);
        _join(id, carol);
        _submit(id, carol);
        _remove(id, bob);
        _review(id, carol, true);
        assertEq(uint8(challenges.getSubmission(id, carol).status), uint8(OrvexChallenges.SubmissionStatus.Approved));
        assertEq(challenges.getChallenge(id).approved, 1);
    }

    // ------------------------------------------------------------ fuzz

    function testFuzz_RemoveRandomParticipantKeepsListConsistent(uint8 nRaw, uint8 idxRaw) public {
        uint256 n = bound(nRaw, 1, 30);
        uint256 idx = bound(idxRaw, 0, n - 1);
        uint64 cid = _tryCreate(10, 20, 8, 0, 1 days, 50);
        address[] memory users = new address[](n);
        for (uint256 i; i < n; ++i) {
            users[i] = address(uint160(0x10000 + i));
            _join(cid, users[i]);
        }
        address victim = users[idx];
        _remove(cid, victim);

        address[] memory l = _list(cid);
        assertEq(l.length, n - 1);
        assertEq(challenges.getChallenge(cid).participants, n - 1);
        assertFalse(challenges.isParticipant(cid, victim));
        assertFalse(_contains(l, victim));
        for (uint256 i; i < n; ++i) {
            if (i == idx) continue;
            assertTrue(_contains(l, users[i]));
            assertTrue(challenges.isParticipant(cid, users[i]));
        }
        // no duplicates
        for (uint256 i; i < l.length; ++i) {
            for (uint256 j = i + 1; j < l.length; ++j) assertTrue(l[i] != l[j]);
        }
        // victim stays banned
        vm.prank(victim);
        vm.expectRevert(OrvexChallenges.RemovedByCreator.selector);
        challenges.joinChallenge(cid);
    }

    function testFuzz_RepeatedRemovalsKeepListConsistent(uint8 nRaw, uint256 seed) public {
        uint256 n = bound(nRaw, 2, 20);
        uint64 cid = _tryCreate(10, 20, 8, 0, 1 days, 50);
        for (uint256 i; i < n; ++i) _join(cid, address(uint160(0x20000 + i)));
        // remove until one is left, always picking a pseudo-random current entry
        for (uint256 r; r < n - 1; ++r) {
            address[] memory l = _list(cid);
            address victim = l[uint256(keccak256(abi.encode(seed, r))) % l.length];
            _remove(cid, victim);
            address[] memory l2 = _list(cid);
            assertEq(l2.length, l.length - 1);
            assertEq(challenges.getChallenge(cid).participants, l2.length);
            assertFalse(_contains(l2, victim));
        }
        assertEq(_list(cid).length, 1);
    }
}
