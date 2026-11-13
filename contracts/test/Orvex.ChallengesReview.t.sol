// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Vm} from "forge-std/Vm.sol";
import {OrvexTestBase} from "./Orvex.Base.t.sol";
import {OrvexChallenges} from "../OrvexChallenges.sol";
import {IOrvexProof} from "../interfaces/IOrvex.sol";

/// @dev Review / close / cancel / views of OrvexChallenges.
contract OrvexChallengesReviewTest is OrvexTestBase {
    // ------------------------------------------------------------------ approve

    function test_ApproveRecordsProofAndReputation() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        skip(60);
        vm.expectEmit(true, true, true, true, address(challenges));
        emit OrvexChallenges.SubmissionReviewed(id, bob, alice, true);
        _review(id, bob, true);

        OrvexChallenges.Submission memory s = challenges.getSubmission(id, bob);
        assertEq(uint8(s.status), uint8(OrvexChallenges.SubmissionStatus.Approved));
        assertEq(s.reviewedAt, T0 + 60);
        assertEq(challenges.getChallenge(id).approved, 1);

        // proof ledger entry: contributor bob, attestor = creator, source challenge
        assertEq(proof.contributionCount(), 1);
        IOrvexProof.Contribution memory c = proof.getContribution(1);
        assertEq(c.contributor, bob);
        assertEq(c.attestor, alice);
        assertEq(uint8(c.source), uint8(IOrvexProof.Source.Challenge));
        assertEq(c.sourceId, id);
        assertEq(c.title, _s(10));
        assertEq(c.uri, "https://x.io/work");
        assertTrue(proof.verifyRecord(1, c.digest));

        // reputation: +20 points, completed counter, verified skill
        assertEq(_st(bob).challengesCompleted, 1);
        assertEq(_st(bob).points, 20);
        (string[] memory names, uint32[] memory counts) = identity.getSkills(bob);
        assertEq(names.length, 1);
        assertEq(names[0], _s(8));
        assertEq(counts[0], 1);
        // creator earns nothing from approval
        assertEq(_st(alice).points, 0);
        assertEq(_st(alice).challengesCompleted, 0);
    }

    function test_ApproveEmitsIdentityAndProofEvents() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        vm.recordLogs();
        _review(id, bob, true);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        // SubmissionReviewed (challenges), ContributionRecorded (proof), ActivityRecorded + SkillVerified (identity)
        assertEq(logs.length, 4);
        assertEq(logs[0].emitter, address(challenges));
        assertEq(logs[1].emitter, address(proof));
        assertEq(logs[2].emitter, address(identity));
        assertEq(logs[3].emitter, address(identity));
    }

    // ------------------------------------------------------------------ reject

    function test_RejectGivesNoProofNoPoints() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        vm.expectEmit(true, true, true, true, address(challenges));
        emit OrvexChallenges.SubmissionReviewed(id, bob, alice, false);
        _review(id, bob, false);
        assertEq(uint8(challenges.getSubmission(id, bob).status), uint8(OrvexChallenges.SubmissionStatus.Rejected));
        assertEq(challenges.getChallenge(id).approved, 0);
        assertEq(proof.contributionCount(), 0);
        assertEq(_st(bob).points, 0);
        assertEq(_st(bob).challengesCompleted, 0);
    }

    // ------------------------------------------------------------------ review access / state

    function test_NonCreatorCannotReview() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        vm.prank(bob);
        vm.expectRevert(OrvexChallenges.NotCreator.selector);
        challenges.reviewSubmission(id, bob, true); // self-approval
        vm.prank(carol);
        vm.expectRevert(OrvexChallenges.NotCreator.selector);
        challenges.reviewSubmission(id, bob, false);
        assertEq(uint8(challenges.getSubmission(id, bob).status), uint8(OrvexChallenges.SubmissionStatus.Pending));
    }

    function test_ReviewUnknownChallengeReverts() public {
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        challenges.reviewSubmission(1, bob, true);
    }

    function test_ReviewWithoutPendingSubmissionReverts() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.SubmissionNotPending.selector);
        challenges.reviewSubmission(id, bob, true); // joined, never submitted
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.SubmissionNotPending.selector);
        challenges.reviewSubmission(id, carol, true); // never joined
    }

    function test_DoubleReviewReverts() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        _review(id, bob, true);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.SubmissionNotPending.selector);
        challenges.reviewSubmission(id, bob, true);
        assertEq(_st(bob).points, 20, "no double award");
        assertEq(proof.contributionCount(), 1);
    }

    function test_ReviewAllowedAfterDeadlineAndAfterClose() public {
        uint64 id = _newChallenge();
        uint64 id2 = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        _join(id2, bob);
        _submit(id2, bob);
        vm.prank(alice);
        challenges.closeChallenge(id2);
        vm.warp(T0 + 2 days);
        _review(id, bob, true);
        _review(id2, bob, true);
        assertEq(_st(bob).challengesCompleted, 2);
        assertEq(_st(bob).points, 40);
    }

    function test_ReviewCancelledReverts() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        // A pending submission now blocks cancellation, so reject it first (see Orvex.PendingCancel.t.sol).
        _review(id, bob, false);
        vm.prank(alice);
        challenges.cancelChallenge(id);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.ChallengeIsCancelled.selector);
        challenges.reviewSubmission(id, bob, true);
    }

    // ------------------------------------------------------------------ close / cancel

    function test_CloseHappyAndAccessControl() public {
        uint64 id = _newChallenge();
        vm.prank(bob);
        vm.expectRevert(OrvexChallenges.NotCreator.selector);
        challenges.closeChallenge(id);
        vm.expectEmit(true, false, false, false, address(challenges));
        emit OrvexChallenges.ChallengeClosed(id);
        vm.prank(alice);
        challenges.closeChallenge(id);
        assertEq(uint8(challenges.getChallenge(id).status), uint8(OrvexChallenges.Status.Closed));
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.ChallengeNotOpen.selector);
        challenges.closeChallenge(id);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        challenges.closeChallenge(99);
    }

    function test_CancelHappyFromOpenAndClosed() public {
        uint64 a = _newChallenge();
        uint64 b = _newChallenge();
        vm.prank(alice);
        challenges.closeChallenge(b);
        vm.expectEmit(true, false, false, false, address(challenges));
        emit OrvexChallenges.ChallengeCancelled(a);
        vm.prank(alice);
        challenges.cancelChallenge(a);
        vm.prank(alice);
        challenges.cancelChallenge(b);
        assertEq(uint8(challenges.getChallenge(a).status), uint8(OrvexChallenges.Status.Cancelled));
        assertEq(uint8(challenges.getChallenge(b).status), uint8(OrvexChallenges.Status.Cancelled));
    }

    function test_CancelAccessAndStateReverts() public {
        uint64 id = _newChallenge();
        vm.prank(bob);
        vm.expectRevert(OrvexChallenges.NotCreator.selector);
        challenges.cancelChallenge(id);
        vm.prank(alice);
        challenges.cancelChallenge(id);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.ChallengeIsCancelled.selector);
        challenges.cancelChallenge(id);
        // cancelled cannot be closed
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.ChallengeNotOpen.selector);
        challenges.closeChallenge(id);
    }

    function test_CancelBlockedAfterApproval() public {
        uint64 id = _newChallenge();
        _complete(id, bob);
        vm.prank(alice);
        vm.expectRevert(OrvexChallenges.HasApprovedSubmissions.selector);
        challenges.cancelChallenge(id);
        assertEq(uint8(challenges.getChallenge(id).status), uint8(OrvexChallenges.Status.Open));
    }

    function test_EffectiveStatus() public {
        uint64 open = _newChallenge();
        uint64 closed = _newChallenge();
        uint64 cancelled = _newChallenge();
        vm.startPrank(alice);
        challenges.closeChallenge(closed);
        challenges.cancelChallenge(cancelled);
        vm.stopPrank();
        assertEq(challenges.effectiveStatus(open), 0);
        assertEq(challenges.effectiveStatus(closed), 1);
        assertEq(challenges.effectiveStatus(cancelled), 2);
        vm.warp(T0 + 1 days - 1);
        assertEq(challenges.effectiveStatus(open), 0);
        vm.warp(T0 + 1 days);
        assertEq(challenges.effectiveStatus(open), 3, "Expired at deadline");
        assertEq(challenges.effectiveStatus(closed), 1);
        assertEq(challenges.effectiveStatus(cancelled), 2);
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        challenges.effectiveStatus(0);
    }

    // ------------------------------------------------------------------ views

    function test_UnknownIdViewsRevert() public {
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        challenges.getChallenge(0);
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        challenges.getChallenge(1);
        _newChallenge();
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        challenges.getChallenge(2);
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        challenges.getSubmission(2, bob);
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        challenges.isParticipant(2, bob);
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        challenges.listParticipants(2, 0, 10);
    }

    function test_GetSubmissionDefaultsToNone() public {
        uint64 id = _newChallenge();
        OrvexChallenges.Submission memory s = challenges.getSubmission(id, bob);
        assertEq(uint8(s.status), uint8(OrvexChallenges.SubmissionStatus.None));
        assertEq(s.attempts, 0);
    }

    function test_ListChallengesPaginationClamps() public {
        for (uint256 i; i < 55; ++i) _newChallenge();
        assertEq(challenges.challengeCount(), 55);
        assertEq(challenges.listChallenges(0, 1000).length, 50);
        assertEq(challenges.listChallenges(50, 1000).length, 5);
        assertEq(challenges.listChallenges(55, 10).length, 0);
        assertEq(challenges.listChallenges(type(uint256).max, type(uint256).max).length, 0);
        assertEq(challenges.listChallenges(0, 0).length, 0);
        assertEq(challenges.listChallenges(9, 1)[0].id, 10);
        assertEq(challenges.listCreatedIds(alice, 0, 1000).length, 50);
        uint64[] memory ids = challenges.listCreatedIds(alice, 53, 1000);
        assertEq(ids.length, 2);
        assertEq(ids[1], 55);
        assertEq(challenges.listCreatedIds(alice, 55, 1).length, 0);
        assertEq(challenges.listCreatedIds(bob, 0, 10).length, 0);
        assertEq(challenges.createdCount(alice), 55);
    }

    function test_ListParticipantsAndJoinedPagination() public {
        uint64 id = _tryCreate(10, 20, 8, 0, 1 days, 1000);
        for (uint256 i; i < 52; ++i) _join(id, address(uint160(0x5000 + i)));
        assertEq(challenges.listParticipants(id, 0, 1000).length, 50);
        assertEq(challenges.listParticipants(id, 50, 1000).length, 2);
        assertEq(challenges.listParticipants(id, 52, 1).length, 0);
        assertEq(challenges.listParticipants(id, type(uint256).max, 5).length, 0);
        assertEq(challenges.listParticipants(id, 1, 1)[0], address(uint160(0x5001)));
        assertEq(challenges.listJoinedIds(address(uint160(0x5000)), 0, 10).length, 1);
        assertEq(challenges.listJoinedIds(address(uint160(0x5000)), 1, 10).length, 0);
        assertEq(challenges.listJoinedIds(bob, 0, 10).length, 0);
    }

    function testFuzz_ListChallengesPagination(uint256 offset, uint256 limit) public {
        for (uint256 i; i < 7; ++i) _newChallenge();
        OrvexChallenges.Challenge[] memory items = challenges.listChallenges(offset, limit);
        uint256 cap = limit > 50 ? 50 : limit;
        uint256 expected = offset >= 7 ? 0 : (cap < 7 - offset ? cap : 7 - offset);
        assertEq(items.length, expected);
        assertLe(items.length, 50);
        if (expected > 0) assertEq(items[0].id, offset + 1);
        assertEq(challenges.listCreatedIds(alice, offset, limit).length, expected);
    }
}
