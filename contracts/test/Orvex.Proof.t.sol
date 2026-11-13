// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {OrvexTestBase} from "./Orvex.Base.t.sol";
import {OrvexProof} from "../OrvexProof.sol";
import {IOrvexIdentity, IOrvexProof, ActivityKind} from "../interfaces/IOrvex.sol";
import {OrvexText} from "../libraries/OrvexText.sol";

contract OrvexProofTest is OrvexTestBase {
    function _rec(address contributor, address attestor, IOrvexProof.Source src, uint64 sid, string memory title, string memory uri)
        internal
        returns (uint64)
    {
        vm.prank(address(challenges));
        return proof.record(contributor, attestor, src, sid, title, uri);
    }

    function _recDefault() internal returns (uint64) {
        return _rec(bob, alice, IOrvexProof.Source.Challenge, 7, "Title", "https://x.io/a");
    }

    function _idRec(address u, ActivityKind k, uint256 times) internal {
        for (uint256 i; i < times; ++i) {
            vm.prank(address(challenges));
            identity.record(u, k, "");
        }
    }

    // ------------------------------------------------------------------ record

    function test_RecordStoresFieldsAndDigest() public {
        uint64 id = _recDefault();
        assertEq(id, 1);
        assertEq(proof.contributionCount(), 1);
        IOrvexProof.Contribution memory c = proof.getContribution(1);
        assertEq(c.id, 1);
        assertEq(c.contributor, bob);
        assertEq(c.attestor, alice);
        assertEq(uint8(c.source), uint8(IOrvexProof.Source.Challenge));
        assertEq(c.sourceId, 7);
        assertEq(c.recordedAt, T0);
        assertEq(c.title, "Title");
        assertEq(c.uri, "https://x.io/a");
        bytes32 expected = keccak256(
            abi.encode(uint64(1), bob, alice, IOrvexProof.Source.Challenge, uint64(7), "Title", "https://x.io/a", block.chainid, address(proof))
        );
        assertEq(c.digest, expected);
        assertEq(proof.userContributionCount(bob), 1);
        assertEq(proof.userContributionCount(alice), 0);
    }

    function test_RecordEmitsContributionRecorded() public {
        bytes32 digest = keccak256(
            abi.encode(uint64(1), bob, alice, IOrvexProof.Source.Project, uint64(3), "T", "ipfs://c", block.chainid, address(proof))
        );
        vm.expectEmit(true, true, true, true, address(proof));
        emit OrvexProof.ContributionRecorded(1, bob, alice, IOrvexProof.Source.Project, 3, digest);
        _rec(bob, alice, IOrvexProof.Source.Project, 3, "T", "ipfs://c");
    }

    function test_DigestIsUniquePerRecordAndDomainSeparated() public {
        uint64 a = _recDefault();
        uint64 b = _recDefault();
        assertNotEq(proof.getContribution(a).digest, proof.getContribution(b).digest);
        // identical inputs from a different proof deployment would differ through address(this)
        OrvexProof other = new OrvexProof(owner, identity);
        vm.prank(owner);
        other.setRecorder(address(this), true);
        uint64 oid = other.record(bob, alice, IOrvexProof.Source.Challenge, 7, "Title", "https://x.io/a");
        assertEq(oid, 1);
        assertNotEq(other.getContribution(1).digest, proof.getContribution(1).digest);
    }

    function test_RecordRevertsForNonRecorder() public {
        vm.prank(alice);
        vm.expectRevert(OrvexProof.NotRecorder.selector);
        proof.record(bob, alice, IOrvexProof.Source.Challenge, 1, "T", "https://x.io");
        vm.prank(owner);
        vm.expectRevert(OrvexProof.NotRecorder.selector);
        proof.record(bob, alice, IOrvexProof.Source.Challenge, 1, "T", "https://x.io");
        // Ideas is a recorder of identity but NOT of proof
        vm.prank(address(ideas));
        vm.expectRevert(OrvexProof.NotRecorder.selector);
        proof.record(bob, alice, IOrvexProof.Source.Challenge, 1, "T", "https://x.io");
    }

    function test_RecordRejectsZeroAddressesAndSourceId() public {
        vm.prank(address(challenges));
        vm.expectRevert(OrvexProof.ZeroAddress.selector);
        proof.record(address(0), alice, IOrvexProof.Source.Challenge, 1, "T", "https://x.io");
        vm.prank(address(challenges));
        vm.expectRevert(OrvexProof.ZeroAddress.selector);
        proof.record(bob, address(0), IOrvexProof.Source.Challenge, 1, "T", "https://x.io");
        vm.prank(address(challenges));
        vm.expectRevert(OrvexProof.InvalidSourceId.selector);
        proof.record(bob, alice, IOrvexProof.Source.Challenge, 0, "T", "https://x.io");
    }

    function test_RecordLengthBounds() public {
        vm.expectRevert(_lenErr(0, 1, 80));
        _rec(bob, alice, IOrvexProof.Source.Challenge, 1, "", "https://x.io");
        vm.expectRevert(_lenErr(81, 1, 80));
        _rec(bob, alice, IOrvexProof.Source.Challenge, 1, _s(81), "https://x.io");
        vm.expectRevert(_lenErr(0, 1, 200));
        _rec(bob, alice, IOrvexProof.Source.Challenge, 1, "T", "");
        vm.expectRevert(_lenErr(201, 1, 200));
        _rec(bob, alice, IOrvexProof.Source.Challenge, 1, "T", _link(201));
        // boundaries accepted
        _rec(bob, alice, IOrvexProof.Source.Challenge, 1, _s(80), _link(200));
        _rec(bob, alice, IOrvexProof.Source.Challenge, 1, _s(1), _link(8));
        assertEq(proof.contributionCount(), 2);
    }

    function test_RecordRejectsBadLinks() public {
        vm.expectRevert(OrvexText.InvalidLink.selector);
        _rec(bob, alice, IOrvexProof.Source.Challenge, 1, "T", "http://x.io");
        vm.expectRevert(OrvexText.InvalidLink.selector);
        _rec(bob, alice, IOrvexProof.Source.Challenge, 1, "T", "javascript:alert(1)");
        vm.expectRevert(OrvexText.InvalidLink.selector);
        _rec(bob, alice, IOrvexProof.Source.Challenge, 1, "T", "ipfs//x");
        _rec(bob, alice, IOrvexProof.Source.Challenge, 1, "T", "ipfs://bafy");
    }

    // ------------------------------------------------------------------ views

    function test_GetContributionUnknownReverts() public {
        vm.expectRevert(OrvexProof.UnknownRecord.selector);
        proof.getContribution(0);
        vm.expectRevert(OrvexProof.UnknownRecord.selector);
        proof.getContribution(1);
        _recDefault();
        proof.getContribution(1);
        vm.expectRevert(OrvexProof.UnknownRecord.selector);
        proof.getContribution(2);
    }

    function test_VerifyRecord() public {
        uint64 id = _recDefault();
        bytes32 d = proof.getContribution(id).digest;
        assertTrue(proof.verifyRecord(id, d));
        assertFalse(proof.verifyRecord(id, bytes32(uint256(d) ^ 1)));
        assertFalse(proof.verifyRecord(id, bytes32(0)));
        assertFalse(proof.verifyRecord(0, d));
        assertFalse(proof.verifyRecord(0, bytes32(0)), "id 0 never verifies, even with zero digest");
        assertFalse(proof.verifyRecord(2, d));
        assertFalse(proof.verifyRecord(2, bytes32(0)));
    }

    function test_RecordsAreImmutableAcrossLaterWrites() public {
        uint64 id = _recDefault();
        IOrvexProof.Contribution memory before = proof.getContribution(id);
        _rec(carol, alice, IOrvexProof.Source.Project, 2, "Other", "https://y.io");
        IOrvexProof.Contribution memory afterC = proof.getContribution(id);
        assertEq(afterC.digest, before.digest);
        assertEq(afterC.title, before.title);
        assertEq(afterC.contributor, before.contributor);
    }

    function test_PaginationClampsAndOutOfRange() public {
        for (uint256 i; i < 55; ++i) _rec(bob, alice, IOrvexProof.Source.Challenge, uint64(i + 1), "T", "https://x.io");
        assertEq(proof.contributionCount(), 55);
        assertEq(proof.listContributions(0, 500).length, 50);
        assertEq(proof.listContributions(50, 500).length, 5);
        assertEq(proof.listContributions(55, 5).length, 0);
        assertEq(proof.listContributions(type(uint256).max, type(uint256).max).length, 0);
        assertEq(proof.listContributions(0, 0).length, 0);
        assertEq(proof.listContributions(3, 2)[0].id, 4);
        assertEq(proof.userContributionCount(bob), 55);
        assertEq(proof.listUserContributionIds(bob, 0, 500).length, 50);
        uint64[] memory ids = proof.listUserContributionIds(bob, 52, 10);
        assertEq(ids.length, 3);
        assertEq(ids[0], 53);
        assertEq(proof.listUserContributionIds(bob, 55, 1).length, 0);
        assertEq(proof.listUserContributionIds(carol, 0, 10).length, 0);
        assertEq(proof.listUserContributionIds(bob, type(uint256).max, 10).length, 0);
    }

    function testFuzz_ListContributionsPagination(uint256 offset, uint256 limit) public {
        for (uint256 i; i < 7; ++i) _rec(bob, alice, IOrvexProof.Source.Challenge, uint64(i + 1), "T", "https://x.io");
        IOrvexProof.Contribution[] memory r = proof.listContributions(offset, limit);
        uint256 cap = limit > 50 ? 50 : limit;
        uint256 expected = offset >= 7 ? 0 : (cap < 7 - offset ? cap : 7 - offset);
        assertEq(r.length, expected);
        if (expected > 0) assertEq(r[0].id, offset + 1);
        uint64[] memory ids = proof.listUserContributionIds(bob, offset, limit);
        assertEq(ids.length, expected);
    }

    // ------------------------------------------------------------------ recorder admin

    function test_SetRecorderAfterFinalizeReverts() public {
        vm.prank(owner);
        vm.expectRevert(OrvexProof.RecorderConfigurationFinalized.selector);
        proof.setRecorder(bob, true);
        vm.prank(owner);
        vm.expectRevert(OrvexProof.RecorderConfigurationFinalized.selector);
        proof.finalizeRecorders();
    }

    function test_FreshProofAdminLifecycle() public {
        OrvexProof p = new OrvexProof(owner, identity);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        p.setRecorder(bob, true);
        vm.prank(owner);
        vm.expectRevert(OrvexProof.ZeroAddress.selector);
        p.setRecorder(address(0), true);
        vm.expectEmit(true, false, false, true, address(p));
        emit OrvexProof.RecorderSet(bob, true);
        vm.prank(owner);
        p.setRecorder(bob, true);
        assertTrue(p.isRecorder(bob));
        vm.prank(owner);
        vm.expectRevert(OrvexProof.RecorderConfigurationNotFinalized.selector);
        p.renounceOwnership();
        vm.expectEmit(address(p));
        emit OrvexProof.RecordersFinalized();
        vm.prank(owner);
        p.finalizeRecorders();
        vm.prank(owner);
        p.renounceOwnership();
        assertEq(p.owner(), address(0));
    }

    function test_ConstructorRejectsZeroIdentity() public {
        vm.expectRevert(OrvexProof.ZeroAddress.selector);
        new OrvexProof(owner, IOrvexIdentity(address(0)));
    }

    // ------------------------------------------------------------------ achievements

    function test_AchievementCountConstantAndUnknownIds() public {
        assertEq(proof.ACHIEVEMENT_COUNT(), 6);
        vm.expectRevert(OrvexProof.UnknownAchievement.selector);
        proof.isEligible(alice, 6);
        vm.expectRevert(OrvexProof.UnknownAchievement.selector);
        proof.isEligible(alice, 255);
        vm.expectRevert(OrvexProof.UnknownAchievement.selector);
        proof.hasAchievement(alice, 6);
        vm.prank(alice);
        vm.expectRevert(OrvexProof.UnknownAchievement.selector);
        proof.claimAchievement(6);
    }

    function test_ClaimWhenIneligibleReverts() public {
        for (uint8 i; i < 6; ++i) {
            assertFalse(proof.isEligible(alice, i));
            vm.prank(alice);
            vm.expectRevert(OrvexProof.NotEligible.selector);
            proof.claimAchievement(i);
        }
    }

    function test_FirstProofAchievement() public {
        _recDefault(); // bob gets a contribution
        assertTrue(proof.isEligible(bob, 0));
        assertFalse(proof.isEligible(alice, 0), "attestor does not earn FIRST_PROOF");
        vm.expectEmit(true, true, false, false, address(proof));
        emit OrvexProof.AchievementClaimed(bob, 0);
        vm.prank(bob);
        proof.claimAchievement(0);
        assertTrue(proof.hasAchievement(bob, 0));
        assertEq(proof.achievementsOf(bob), 1);
        assertEq(proof.achievementMask(bob), 1);
    }

    function test_DuplicateClaimReverts() public {
        _recDefault();
        vm.prank(bob);
        proof.claimAchievement(0);
        vm.prank(bob);
        vm.expectRevert(OrvexProof.AlreadyClaimed.selector);
        proof.claimAchievement(0);
    }

    function test_ClaimIsForCallerOnly() public {
        _recDefault();
        // alice cannot claim bob's eligibility
        vm.prank(alice);
        vm.expectRevert(OrvexProof.NotEligible.selector);
        proof.claimAchievement(0);
        assertEq(proof.achievementsOf(bob), 0);
    }

    function test_ChallengerAndOrganizerViaRealFlow() public {
        uint64 id = _newChallenge();
        assertTrue(proof.isEligible(alice, 3), "ORGANIZER after creating");
        assertFalse(proof.isEligible(bob, 1));
        _complete(id, bob);
        assertTrue(proof.isEligible(bob, 1), "CHALLENGER");
        assertTrue(proof.isEligible(bob, 0), "approval also records a proof");
        assertFalse(proof.isEligible(bob, 2));
        vm.prank(bob);
        proof.claimAchievement(1);
        vm.prank(bob);
        proof.claimAchievement(0);
        vm.prank(alice);
        proof.claimAchievement(3);
        assertEq(proof.achievementsOf(bob), 3);
        assertEq(proof.achievementsOf(alice), 8);
        assertTrue(proof.hasAchievement(alice, 3));
        assertFalse(proof.hasAchievement(alice, 1));
    }

    function test_BuilderNeedsFiveCompletions() public {
        _idRec(bob, ActivityKind.ChallengeCompleted, 4);
        assertTrue(proof.isEligible(bob, 1));
        assertFalse(proof.isEligible(bob, 2));
        _idRec(bob, ActivityKind.ChallengeCompleted, 1);
        assertTrue(proof.isEligible(bob, 2));
        vm.prank(bob);
        proof.claimAchievement(2);
        assertEq(proof.achievementsOf(bob), 4);
    }

    function test_VisionaryViaProjectOrIdea() public {
        assertFalse(proof.isEligible(alice, 4));
        _newProject();
        assertTrue(proof.isEligible(alice, 4));
        _newIdea();
        assertTrue(proof.isEligible(alice, 4));
        // idea-only user
        vm.prank(bob);
        ideas.postIdea("An idea", "A longer idea body", "tag");
        assertTrue(proof.isEligible(bob, 4));
        vm.prank(bob);
        proof.claimAchievement(4);
        assertTrue(proof.hasAchievement(bob, 4));
    }

    function test_LuminaryAt500Points() public {
        _idRec(bob, ActivityKind.ChallengeCompleted, 24); // 480
        assertFalse(proof.isEligible(bob, 5));
        _idRec(bob, ActivityKind.ChallengeCompleted, 1); // 500
        assertTrue(proof.isEligible(bob, 5));
        vm.prank(bob);
        proof.claimAchievement(5);
        assertEq(proof.achievementsOf(bob), 32);
    }

    function test_EndorsementsAloneGiveNoAchievement() public {
        _idRec(bob, ActivityKind.EndorsementReceived, 10);
        _idRec(bob, ActivityKind.ChallengeJoined, 10);
        for (uint8 i; i < 6; ++i) assertFalse(proof.isEligible(bob, i));
    }
}
