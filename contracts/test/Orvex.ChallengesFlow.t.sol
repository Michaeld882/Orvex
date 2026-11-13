// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {OrvexTestBase} from "./Orvex.Base.t.sol";
import {OrvexChallenges} from "../OrvexChallenges.sol";
import {OrvexText} from "../libraries/OrvexText.sol";
import {IOrvexIdentity, IOrvexProof} from "../interfaces/IOrvex.sol";

/// @dev Create / join / submit paths of OrvexChallenges.
contract OrvexChallengesFlowTest is OrvexTestBase {
    // ------------------------------------------------------------------ constructor

    function test_ConstructorRejectsZeroSiblings() public {
        vm.expectRevert(OrvexChallenges.ZeroAddress.selector);
        new OrvexChallenges(IOrvexIdentity(address(0)), proof);
        vm.expectRevert(OrvexChallenges.ZeroAddress.selector);
        new OrvexChallenges(identity, IOrvexProof(address(0)));
    }

    // ------------------------------------------------------------------ create

    function test_CreateChallengeHappy() public {
        uint64 id = _tryCreate(10, 20, 8, 5, 1 days, 10);
        assertEq(id, 1);
        assertEq(challenges.challengeCount(), 1);
        OrvexChallenges.Challenge memory c = challenges.getChallenge(1);
        assertEq(c.id, 1);
        assertEq(c.creator, alice);
        assertEq(c.createdAt, T0);
        assertEq(c.deadline, T0 + 1 days);
        assertEq(c.maxParticipants, 10);
        assertEq(c.participants, 0);
        assertEq(c.submissions, 0);
        assertEq(c.approved, 0);
        assertEq(uint8(c.status), uint8(OrvexChallenges.Status.Open));
        assertEq(c.title, _s(10));
        assertEq(c.description, _s(20));
        assertEq(c.skill, _s(8));
        assertEq(c.rewardNote, _s(5));
        assertEq(challenges.createdCount(alice), 1);
        assertEq(_st(alice).challengesCreated, 1);
        assertEq(_st(alice).points, 0);
    }

    function test_CreateChallengeEmits() public {
        vm.expectEmit(true, true, false, true, address(challenges));
        emit OrvexChallenges.ChallengeCreated(1, alice, uint40(T0 + 2 days), 25, "Hello world");
        vm.prank(alice);
        challenges.createChallenge("Hello world", _s(20), "solidity", "", uint40(T0 + 2 days), 25);
    }

    function test_CreateIdsIncrement() public {
        assertEq(_newChallenge(), 1);
        assertEq(_newChallenge(), 2);
        assertEq(challenges.createdCount(alice), 2);
    }

    function test_CreateLengthBoundariesAccepted() public {
        _tryCreate(3, 10, 1, 0, 1 days, 1);
        _tryCreate(80, 1000, 24, 120, 1 days, 1000);
        assertEq(challenges.challengeCount(), 2);
    }

    function test_CreateRevertsOnEveryLengthBound() public {
        vm.expectRevert(_lenErr(2, 3, 80));
        _tryCreate(2, 20, 8, 0, 1 days, 10);
        vm.expectRevert(_lenErr(81, 3, 80));
        _tryCreate(81, 20, 8, 0, 1 days, 10);
        vm.expectRevert(_lenErr(9, 10, 1000));
        _tryCreate(10, 9, 8, 0, 1 days, 10);
        vm.expectRevert(_lenErr(1001, 10, 1000));
        _tryCreate(10, 1001, 8, 0, 1 days, 10);
        vm.expectRevert(_lenErr(0, 1, 24));
        _tryCreate(10, 20, 0, 0, 1 days, 10);
        vm.expectRevert(_lenErr(25, 1, 24));
        _tryCreate(10, 20, 25, 0, 1 days, 10);
        vm.expectRevert(_lenErr(121, 0, 120));
        _tryCreate(10, 20, 8, 121, 1 days, 10);
        assertEq(challenges.challengeCount(), 0);
    }

    function test_CreateDeadlineRange() public {
        uint256 minD = T0 + 1 hours;
        uint256 maxD = T0 + 365 days;
        // boundaries accepted
        _tryCreate(10, 20, 8, 0, 1 hours, 10);
        _tryCreate(10, 20, 8, 0, 365 days, 10);
        // one second too early / too late: error carries (submitted, min, max)
        vm.expectRevert(abi.encodeWithSelector(OrvexChallenges.InvalidDeadline.selector, minD - 1, minD, maxD));
        _tryCreate(10, 20, 8, 0, 1 hours - 1, 10);
        vm.expectRevert(abi.encodeWithSelector(OrvexChallenges.InvalidDeadline.selector, maxD + 1, minD, maxD));
        _tryCreate(10, 20, 8, 0, 365 days + 1, 10);
        // in the past (deadline 0 offset == now)
        vm.expectRevert(abi.encodeWithSelector(OrvexChallenges.InvalidDeadline.selector, T0, minD, maxD));
        _tryCreate(10, 20, 8, 0, 0, 10);
    }

    function test_CreateDeadlineBoundsMoveWithTime() public {
        skip(10 days);
        uint256 n = block.timestamp;
        vm.expectRevert(abi.encodeWithSelector(OrvexChallenges.InvalidDeadline.selector, T0 + 1 days, n + 1 hours, n + 365 days));
        vm.prank(alice);
        challenges.createChallenge(_s(10), _s(20), _s(8), "", uint40(T0 + 1 days), 10);
    }

    function test_CreateRevertsOnInvalidCapacity() public {
        vm.expectRevert(OrvexChallenges.InvalidCapacity.selector);
        _tryCreate(10, 20, 8, 0, 1 days, 0);
        vm.expectRevert(OrvexChallenges.InvalidCapacity.selector);
        _tryCreate(10, 20, 8, 0, 1 days, 1001);
        vm.expectRevert(OrvexChallenges.InvalidCapacity.selector);
        _tryCreate(10, 20, 8, 0, 1 days, type(uint32).max);
    }

    // ------------------------------------------------------------------ join

    function test_JoinHappyEmitsAndRecords() public {
        uint64 id = _newChallenge();
        vm.expectEmit(true, true, false, false, address(challenges));
        emit OrvexChallenges.ChallengeJoined(id, bob);
        _join(id, bob);
        assertTrue(challenges.isParticipant(id, bob));
        assertFalse(challenges.isParticipant(id, carol));
        assertEq(challenges.getChallenge(id).participants, 1);
        assertEq(challenges.joinedCount(bob), 1);
        assertEq(challenges.listJoinedIds(bob, 0, 10)[0], id);
        assertEq(challenges.listParticipants(id, 0, 10)[0], bob);
        assertEq(_st(bob).challengesJoined, 1);
        assertEq(_st(bob).points, 0);
    }

    function test_CreatorCannotJoin() public {
        uint64 id = _newChallenge();
        vm.expectRevert(OrvexChallenges.CreatorCannotJoin.selector);
        _join(id, alice);
    }

    function test_JoinTwiceReverts() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        vm.expectRevert(OrvexChallenges.AlreadyJoined.selector);
        _join(id, bob);
        assertEq(challenges.getChallenge(id).participants, 1);
    }

    function test_JoinUnknownChallengeReverts() public {
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        _join(0, bob);
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        _join(1, bob);
    }

    function test_JoinFullReverts() public {
        uint64 id = _tryCreate(10, 20, 8, 0, 1 days, 2);
        _join(id, bob);
        _join(id, carol);
        vm.expectRevert(OrvexChallenges.ChallengeFull.selector);
        _join(id, dave);
        assertEq(challenges.getChallenge(id).participants, 2);
    }

    function test_JoinAfterDeadlineReverts() public {
        uint64 id = _newChallenge();
        vm.warp(T0 + 1 days - 1);
        _join(id, bob);
        vm.warp(T0 + 1 days);
        vm.expectRevert(OrvexChallenges.ChallengeNotOpen.selector);
        _join(id, carol);
    }

    function test_JoinClosedOrCancelledReverts() public {
        uint64 a = _newChallenge();
        uint64 b = _newChallenge();
        vm.startPrank(alice);
        challenges.closeChallenge(a);
        challenges.cancelChallenge(b);
        vm.stopPrank();
        vm.expectRevert(OrvexChallenges.ChallengeNotOpen.selector);
        _join(a, bob);
        vm.expectRevert(OrvexChallenges.ChallengeNotOpen.selector);
        _join(b, bob);
    }

    // ------------------------------------------------------------------ submit

    function test_SubmitWorkHappy() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        skip(5);
        vm.expectEmit(true, true, false, true, address(challenges));
        emit OrvexChallenges.WorkSubmitted(id, bob, 1);
        _submit(id, bob);
        OrvexChallenges.Submission memory s = challenges.getSubmission(id, bob);
        assertEq(uint8(s.status), uint8(OrvexChallenges.SubmissionStatus.Pending));
        assertEq(s.attempts, 1);
        assertEq(s.submittedAt, T0 + 5);
        assertEq(s.reviewedAt, 0);
        assertEq(s.uri, "https://x.io/work");
        assertEq(s.note, "my note");
        assertEq(challenges.getChallenge(id).submissions, 1);
    }

    function test_SubmitRequiresParticipant() public {
        uint64 id = _newChallenge();
        vm.expectRevert(OrvexChallenges.NotParticipant.selector);
        _submit(id, bob);
        // creator is never a participant
        vm.expectRevert(OrvexChallenges.NotParticipant.selector);
        _submit(id, alice);
    }

    function test_SubmitUnknownChallengeReverts() public {
        vm.expectRevert(OrvexChallenges.UnknownChallenge.selector);
        _submit(5, bob);
    }

    function test_SubmitAfterDeadlineOrClosedReverts() public {
        uint64 id = _newChallenge();
        uint64 id2 = _newChallenge();
        _join(id, bob);
        _join(id2, bob);
        vm.prank(alice);
        challenges.closeChallenge(id2);
        vm.expectRevert(OrvexChallenges.ChallengeNotOpen.selector);
        _submit(id2, bob);
        vm.warp(T0 + 1 days);
        vm.expectRevert(OrvexChallenges.ChallengeNotOpen.selector);
        _submit(id, bob);
    }

    function test_SubmitBadInputs() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        vm.startPrank(bob);
        vm.expectRevert(_lenErr(0, 1, 200));
        challenges.submitWork(id, "", "n");
        vm.expectRevert(_lenErr(201, 1, 200));
        challenges.submitWork(id, _link(201), "n");
        vm.expectRevert(OrvexText.InvalidLink.selector);
        challenges.submitWork(id, "http://x.io", "n");
        vm.expectRevert(OrvexText.InvalidLink.selector);
        challenges.submitWork(id, "not a link at all", "n");
        vm.expectRevert(_lenErr(281, 0, 280));
        challenges.submitWork(id, "https://x.io", _s(281));
        // boundaries accepted: empty note, 280-byte note, 200-byte link, ipfs
        challenges.submitWork(id, _link(200), _s(280));
        vm.stopPrank();
        assertEq(challenges.getSubmission(id, bob).attempts, 1);
    }

    function test_CannotResubmitWhilePendingOrAfterApproval() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        vm.expectRevert(OrvexChallenges.InvalidSubmissionStatus.selector);
        _submit(id, bob);
        _review(id, bob, true);
        vm.expectRevert(OrvexChallenges.InvalidSubmissionStatus.selector);
        _submit(id, bob);
        assertEq(challenges.getSubmission(id, bob).attempts, 1);
    }

    function test_ResubmitAfterRejectionAndMaxAttempts() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        for (uint8 i = 1; i <= 3; ++i) {
            vm.expectEmit(true, true, false, true, address(challenges));
            emit OrvexChallenges.WorkSubmitted(id, bob, i);
            _submit(id, bob);
            assertEq(challenges.getSubmission(id, bob).attempts, i);
            _review(id, bob, false);
            assertEq(uint8(challenges.getSubmission(id, bob).status), uint8(OrvexChallenges.SubmissionStatus.Rejected));
        }
        assertEq(challenges.MAX_ATTEMPTS(), 3);
        vm.expectRevert(OrvexChallenges.TooManyAttempts.selector);
        _submit(id, bob);
        // submissions counter counts the participant once, not per attempt
        assertEq(challenges.getChallenge(id).submissions, 1);
    }

    function test_ResubmitClearsReviewedAtAndReplacesContent() public {
        uint64 id = _newChallenge();
        _join(id, bob);
        _submit(id, bob);
        skip(10);
        _review(id, bob, false);
        assertEq(challenges.getSubmission(id, bob).reviewedAt, T0 + 10);
        skip(10);
        vm.prank(bob);
        challenges.submitWork(id, "ipfs://newcid", "second try");
        OrvexChallenges.Submission memory s = challenges.getSubmission(id, bob);
        assertEq(s.reviewedAt, 0);
        assertEq(s.uri, "ipfs://newcid");
        assertEq(s.note, "second try");
        assertEq(s.submittedAt, T0 + 20);
    }
}
