// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {OrvexTestBase} from "./Orvex.Base.t.sol";
import {OrvexChallenges} from "../OrvexChallenges.sol";

contract OrvexPendingCancelTest is OrvexTestBase {
    address internal eve = makeAddr("eve");

    function _pc(uint64 id) internal view returns (uint32) {
        return challenges.pendingCount(id);
    }

    function _cancel(uint64 id) internal {
        vm.prank(alice);
        challenges.cancelChallenge(id);
    }

    function _status(uint64 id, address u) internal view returns (OrvexChallenges.SubmissionStatus) {
        return challenges.getSubmission(id, u).status;
    }

    // ------------------------------------------------------------------ pendingCount view

    function test_PendingCountZeroOnNewChallenge() public {
        uint64 id = _newChallenge();
        assertEq(_pc(id), 0);
    }

    function test_PendingCountUnknownReverts() public {
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        challenges.pendingCount(0);
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        challenges.pendingCount(1);
        _newChallenge();
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        challenges.pendingCount(2);
        assertEq(_pc(1), 0);
    }

    // ------------------------------------------------------------------ cancel vs pending

    function test_CancelRevertsWithPendingSubmission() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.HasPendingSubmissions.selector);
        challenges.cancelChallenge(id);
        assertEq(uint8(challenges.getChallenge(id).status), uint8(OrvexChallenges.Status.Open));
        assertEq(_pc(id), 1);
    }

    function test_CancelNonCreatorStillNotCreatorWithPending() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        vm.prank(bob);
        vm.expectRevert(OrvexChallenges.NotCreator.selector);
        challenges.cancelChallenge(id);
    }

    function test_CancelRevertsWithPendingWhenClosed() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        vm.prank(alice);
        challenges.closeChallenge(id);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.HasPendingSubmissions.selector);
        challenges.cancelChallenge(id);
    }

    function test_CancelRevertsWithPendingAfterDeadline() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        vm.warp(T0 + 1 days + 1);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.HasPendingSubmissions.selector);
        challenges.cancelChallenge(id);
    }

    function test_CancelWorksAfterPendingRejected() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        _review(id, bob, false);
        vm.expectEmit(true, false, false, false, address(challenges));
        emit OrvexChallenges.ChallengeCancelled(id);
        _cancel(id);
        assertEq(uint8(challenges.getChallenge(id).status), uint8(OrvexChallenges.Status.Cancelled));
        assertEq(_pc(id), 0);
    }

    function test_CancelStillRevertsHasApprovedAfterApproval() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        _review(id, bob, true);
        assertEq(_pc(id), 0);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.HasApprovedSubmissions.selector);
        challenges.cancelChallenge(id);
    }

    function test_ApprovedTakesPrecedenceOverPending() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _join(id, carol);
        _submit(id, bob);
        _submit(id, carol);
        _review(id, bob, true);
        assertEq(_pc(id), 1);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.HasApprovedSubmissions.selector);
        challenges.cancelChallenge(id);
    }

    function test_CancelOfEmptyChallengeStillWorks() public {
        uint64 id = _newChallenge();
        _join(id, bob); // joined but never submitted
        _cancel(id);
        assertEq(uint8(challenges.getChallenge(id).status), uint8(OrvexChallenges.Status.Cancelled));
    }

    function test_CancelAlreadyCancelledStillReverts() public {
        uint64 id = _newChallenge();
        _cancel(id);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.ChallengeIsCancelled.selector);
        challenges.cancelChallenge(id);
    }

    // ------------------------------------------------------------------ multiple participants / mixed states

    function test_MixedPendingStatesBlockUntilAllReviewed() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _join(id, carol);
        _join(id, dave);
        _submit(id, bob);
        _submit(id, carol);
        _submit(id, dave);
        assertEq(_pc(id), 3);

        _review(id, bob, false);
        assertEq(_pc(id), 2);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.HasPendingSubmissions.selector);
        challenges.cancelChallenge(id);

        _review(id, carol, false);
        assertEq(_pc(id), 1);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.HasPendingSubmissions.selector);
        challenges.cancelChallenge(id);

        _review(id, dave, false);
        assertEq(_pc(id), 0);
        _cancel(id);
        assertEq(uint8(challenges.getChallenge(id).status), uint8(OrvexChallenges.Status.Cancelled));
    }

    function test_RejectedAndNoneParticipantsDoNotBlockCancel() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _join(id, carol);
        _join(id, dave);
        _submit(id, bob);
        _review(id, bob, false); // rejected
        _submit(id, carol);
        _review(id, carol, false); // rejected; dave never submits
        assertEq(_pc(id), 0);
        _cancel(id);
        assertEq(uint8(challenges.getChallenge(id).status), uint8(OrvexChallenges.Status.Cancelled));
    }

    function test_PendingCountIsPerChallenge() public {
        uint64 a = _newChallenge();
        uint64 b = _newChallenge();
        _join(a, bob);
        _join(b, bob);
        _join(b, carol);
        _submit(a, bob);
        _submit(b, bob);
        _submit(b, carol);
        assertEq(_pc(a), 1);
        assertEq(_pc(b), 2);
        _review(a, bob, false);
        assertEq(_pc(a), 0);
        assertEq(_pc(b), 2);
        _cancel(a);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.HasPendingSubmissions.selector);
        challenges.cancelChallenge(b);
    }

    // ------------------------------------------------------------------ pendingCount transitions

    function test_PendingCountSubmitReviewResubmit() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        assertEq(_pc(id), 0);
        _submit(id, bob);
        assertEq(_pc(id), 1);
        _review(id, bob, false);
        assertEq(_pc(id), 0);
        _submit(id, bob); // resubmission after rejection
        assertEq(_pc(id), 1);
        assertEq(challenges.getSubmission(id, bob).attempts, 2);
        _review(id, bob, false);
        assertEq(_pc(id), 0);
        _submit(id, bob);
        assertEq(_pc(id), 1);
        _review(id, bob, true);
        assertEq(_pc(id), 0);
    }

    function test_PendingCountUnchangedByFailedCalls() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        // duplicate submit while pending reverts and does not double count
        vm.prank(bob);
        vm.expectRevert(OrvexChallenges.InvalidSubmissionStatus.selector);
        challenges.submitWork(id, "https://x.io/work", "n");
        // non-participant submit reverts
        vm.prank(carol);
        vm.expectRevert(OrvexChallenges.NotParticipant.selector);
        challenges.submitWork(id, "https://x.io/work", "n");
        // non-creator review reverts
        vm.prank(carol);
        vm.expectRevert(OrvexChallenges.NotCreator.selector);
        challenges.reviewSubmission(id, bob, true);
        assertEq(_pc(id), 1);
        // reviewing a non-pending participant reverts and does not underflow the count
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.SubmissionNotPending.selector);
        challenges.reviewSubmission(id, carol, true);
        assertEq(_pc(id), 1);
        _review(id, bob, false);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.SubmissionNotPending.selector);
        challenges.reviewSubmission(id, bob, true);
        assertEq(_pc(id), 0);
    }

    function test_TooManyAttemptsDoesNotChangePendingCount() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        for (uint256 i; i < 3; ++i) {
            _submit(id, bob);
            _review(id, bob, false);
        }
        vm.prank(bob);
        vm.expectRevert(OrvexChallenges.TooManyAttempts.selector);
        challenges.submitWork(id, "https://x.io/work", "n");
        assertEq(_pc(id), 0);
        _cancel(id);
    }

    function test_ReviewAfterCloseDecrementsPending() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        vm.prank(alice);
        challenges.closeChallenge(id);
        assertEq(_pc(id), 1);
        _review(id, bob, false);
        assertEq(_pc(id), 0);
        _cancel(id);
    }

    // ------------------------------------------------------------------ removeParticipant

    function test_RemoveRejectedParticipantDoesNotChangePendingCount() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _join(id, carol);
        _submit(id, bob);
        _submit(id, carol);
        _review(id, bob, false);
        assertEq(_pc(id), 1);
        vm.prank(alice);
        challenges.removeParticipant(id, bob);
        assertEq(_pc(id), 1, "removal of rejected participant leaves pending count");
        assertFalse(challenges.isParticipant(id, bob));
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.HasPendingSubmissions.selector);
        challenges.cancelChallenge(id);
        _review(id, carol, false);
        assertEq(_pc(id), 0);
        _cancel(id);
    }

    function test_RemovePendingParticipantRevertsAndKeepsCount() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.ParticipantHasSubmitted.selector);
        challenges.removeParticipant(id, bob);
        assertEq(_pc(id), 1);
    }

    function test_RemoveSoleRejectedParticipantThenCancel() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        _review(id, bob, false);
        vm.prank(alice);
        challenges.removeParticipant(id, bob);
        assertEq(_pc(id), 0);
        _cancel(id);
        assertEq(uint8(challenges.getChallenge(id).status), uint8(OrvexChallenges.Status.Cancelled));
    }

    // ------------------------------------------------------------------ fuzz

    /// @dev PROPERTY: after any sequence of submits/reviews, pendingCount == number of Pending submissions,
    /// and cancelChallenge reverts exactly as the pending/approved state dictates.
    function testFuzz_PendingCountEqualsPendingSubmissions(uint256 seed, uint8 steps) public {
        uint256 n = bound(steps, 1, 60);
        uint64 id = _newChallenge();
        address[4] memory users = [bob, carol, dave, eve];
        for (uint256 i; i < 4; ++i) _join(id, users[i]);

        for (uint256 i; i < n; ++i) {
            uint256 r = uint256(keccak256(abi.encode(seed, i)));
            address u = users[r % 4];
            bool doSubmit = (r >> 8) % 2 == 0;
            if (doSubmit) {
                vm.prank(u);
                try challenges.submitWork(id, "https://x.io/work", "n") {} catch {}
            } else {
                vm.prank(alice);
                try challenges.reviewSubmission(id, u, (r >> 16) % 2 == 0) {} catch {}
            }
            assertEq(_pc(id), _countStatus(id, users, OrvexChallenges.SubmissionStatus.Pending));
        }

        uint256 pending = _countStatus(id, users, OrvexChallenges.SubmissionStatus.Pending);
        uint256 approved = _countStatus(id, users, OrvexChallenges.SubmissionStatus.Approved);
        assertEq(approved, challenges.getChallenge(id).approved);
        vm.prank(alice);
        if (approved != 0) {
            vm.expectRevert(OrvexChallenges.HasApprovedSubmissions.selector);
        } else if (pending != 0) {
            vm.expectRevert(OrvexChallenges.HasPendingSubmissions.selector);
        }
        challenges.cancelChallenge(id);
    }

    function _countStatus(uint64 id, address[4] memory users, OrvexChallenges.SubmissionStatus st) internal view returns (uint256 c) {
        for (uint256 i; i < 4; ++i) if (_status(id, users[i]) == st) ++c;
    }
}
