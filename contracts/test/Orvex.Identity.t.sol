// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {OrvexTestBase} from "./Orvex.Base.t.sol";
import {OrvexIdentity} from "../OrvexIdentity.sol";
import {IOrvexIdentity, ActivityKind} from "../interfaces/IOrvex.sol";
import {OrvexText} from "../libraries/OrvexText.sol";

contract OrvexIdentityTest is OrvexTestBase {
    OrvexIdentity internal fresh;

    function _fresh() internal {
        fresh = new OrvexIdentity(owner);
    }

    function _rec(address u, ActivityKind k, string memory skill) internal {
        vm.prank(address(challenges));
        identity.record(u, k, skill);
    }

    function _seed(uint256 n) internal {
        for (uint256 i; i < n; ++i) _rec(address(uint160(0x1000 + i)), ActivityKind.IdeaPosted, "");
    }

    // ------------------------------------------------------------------ wiring (mirrors DeployOrvex)

    function test_DeployWiring() public view {
        assertEq(identity.owner(), owner);
        assertTrue(identity.recordersFinalized());
        assertTrue(proof.recordersFinalized());
        assertTrue(identity.isRecorder(address(challenges)));
        assertTrue(identity.isRecorder(address(launchpad)));
        assertTrue(identity.isRecorder(address(ideas)));
        assertFalse(identity.isRecorder(address(proof)));
        assertTrue(proof.isRecorder(address(challenges)));
        assertTrue(proof.isRecorder(address(launchpad)));
        assertFalse(proof.isRecorder(address(ideas)));
        assertEq(address(proof.identity()), address(identity));
        assertEq(address(challenges.identity()), address(identity));
        assertEq(address(challenges.proof()), address(proof));
        assertEq(address(launchpad.identity()), address(identity));
        assertEq(address(launchpad.proof()), address(proof));
        assertEq(address(ideas.identity()), address(identity));
    }

    // ------------------------------------------------------------------ recorder admin

    function test_SetRecorderHappyEmits() public {
        _fresh();
        vm.expectEmit(true, false, false, true, address(fresh));
        emit OrvexIdentity.RecorderSet(bob, true);
        vm.prank(owner);
        fresh.setRecorder(bob, true);
        assertTrue(fresh.isRecorder(bob));
        vm.prank(owner);
        fresh.setRecorder(bob, false);
        assertFalse(fresh.isRecorder(bob));
    }

    function test_SetRecorderRevertsForNonOwner() public {
        _fresh();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        fresh.setRecorder(bob, true);
    }

    function test_SetRecorderRejectsZeroAddress() public {
        _fresh();
        vm.prank(owner);
        vm.expectRevert(OrvexIdentity.ZeroAddress.selector);
        fresh.setRecorder(address(0), true);
    }

    function test_FinalizeEmitsAndFreezesSetRecorder() public {
        _fresh();
        vm.expectEmit(address(fresh));
        emit OrvexIdentity.RecordersFinalized();
        vm.prank(owner);
        fresh.finalizeRecorders();
        assertTrue(fresh.recordersFinalized());
        vm.prank(owner);
        vm.expectRevert(OrvexIdentity.RecorderConfigurationFinalized.selector);
        fresh.setRecorder(bob, true);
    }

    function test_SetRecorderAfterFinalizeRevertsOnDeployedSuite() public {
        vm.prank(owner);
        vm.expectRevert(OrvexIdentity.RecorderConfigurationFinalized.selector);
        identity.setRecorder(bob, true);
        // Even removing an existing recorder is impossible.
        vm.prank(owner);
        vm.expectRevert(OrvexIdentity.RecorderConfigurationFinalized.selector);
        identity.setRecorder(address(ideas), false);
        assertTrue(identity.isRecorder(address(ideas)));
    }

    function test_FinalizeTwiceReverts() public {
        vm.prank(owner);
        vm.expectRevert(OrvexIdentity.RecorderConfigurationFinalized.selector);
        identity.finalizeRecorders();
    }

    function test_FinalizeRevertsForNonOwner() public {
        _fresh();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        fresh.finalizeRecorders();
    }

    function test_RenounceBeforeFinalizeReverts() public {
        _fresh();
        vm.prank(owner);
        vm.expectRevert(OrvexIdentity.RecorderConfigurationNotFinalized.selector);
        fresh.renounceOwnership();
        assertEq(fresh.owner(), owner);
    }

    function test_RenounceAfterFinalizeWorks() public {
        vm.prank(owner);
        identity.renounceOwnership();
        assertEq(identity.owner(), address(0));
    }

    function test_RenounceByNonOwnerReverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        identity.renounceOwnership();
    }

    function test_TwoStepOwnershipTransfer() public {
        vm.prank(owner);
        identity.transferOwnership(bob);
        assertEq(identity.owner(), owner);
        vm.prank(bob);
        identity.acceptOwnership();
        assertEq(identity.owner(), bob);
    }

    // ------------------------------------------------------------------ profile

    function test_SetProfileHappyAndUpdate() public {
        vm.expectEmit(true, false, false, false, address(identity));
        emit OrvexIdentity.ProfileUpdated(alice);
        vm.prank(alice);
        identity.setProfile("Alice", "bio", "solidity", "https://alice.io");
        IOrvexIdentity.Profile memory p = identity.getProfile(alice);
        assertEq(p.displayName, "Alice");
        assertEq(p.bio, "bio");
        assertEq(p.skillsNote, "solidity");
        assertEq(p.link, "https://alice.io");
        assertEq(p.updatedAt, T0);
        assertTrue(p.exists);
        assertEq(identity.totalProfiles(), 1);

        skip(100);
        vm.prank(alice);
        identity.setProfile("Alice2", "", "", "ipfs://cid");
        p = identity.getProfile(alice);
        assertEq(p.displayName, "Alice2");
        assertEq(p.updatedAt, T0 + 100);
        assertEq(identity.totalProfiles(), 1, "update must not double count");

        vm.prank(bob);
        identity.setProfile("Bob", "", "", "");
        assertEq(identity.totalProfiles(), 2);
        assertFalse(identity.getProfile(carol).exists);
    }

    function _profile(uint256 n, uint256 b, uint256 sk, string memory link) internal {
        vm.prank(alice);
        identity.setProfile(_s(n), _s(b), _s(sk), link);
    }

    function test_ProfileLengthBoundsAccepted() public {
        _profile(1, 0, 0, "");
        _profile(32, 280, 120, _link(200));
        assertTrue(identity.getProfile(alice).exists);
    }

    function test_ProfileRevertsOnBadLengths() public {
        vm.expectRevert(_lenErr(0, 1, 32));
        _profile(0, 0, 0, "");
        vm.expectRevert(_lenErr(33, 1, 32));
        _profile(33, 0, 0, "");
        vm.expectRevert(_lenErr(281, 0, 280));
        _profile(1, 281, 0, "");
        vm.expectRevert(_lenErr(121, 0, 120));
        _profile(1, 0, 121, "");
        vm.expectRevert(_lenErr(201, 0, 200));
        _profile(1, 0, 0, _link(201));
    }

    function test_ProfileRevertsOnBadLink() public {
        vm.expectRevert(OrvexText.InvalidLink.selector);
        _profile(1, 0, 0, "http://insecure.io");
        vm.expectRevert(OrvexText.InvalidLink.selector);
        _profile(1, 0, 0, "ftp://x");
        vm.expectRevert(OrvexText.InvalidLink.selector);
        _profile(1, 0, 0, "ipfs:/x");
    }

    // ------------------------------------------------------------------ record: access + counters + points

    function test_RecordRevertsForNonRecorder() public {
        vm.prank(alice);
        vm.expectRevert(OrvexIdentity.NotRecorder.selector);
        identity.record(alice, ActivityKind.IdeaPosted, "");
        // not even the owner may record
        vm.prank(owner);
        vm.expectRevert(OrvexIdentity.NotRecorder.selector);
        identity.record(alice, ActivityKind.ChallengeCompleted, "x");
    }

    function test_RecordRejectsZeroUser() public {
        vm.prank(address(ideas));
        vm.expectRevert(OrvexIdentity.ZeroAddress.selector);
        identity.record(address(0), ActivityKind.IdeaPosted, "");
    }

    function test_RecordRejectsOverlongSkill() public {
        vm.prank(address(challenges));
        vm.expectRevert(_lenErr(25, 1, 24));
        identity.record(alice, ActivityKind.ChallengeCompleted, _s(25));
    }

    function test_EveryKindBumpsItsCounterAndPoints() public {
        _rec(alice, ActivityKind.ChallengeCreated, "");
        _rec(alice, ActivityKind.ChallengeJoined, "");
        _rec(alice, ActivityKind.ProjectProposed, "");
        _rec(alice, ActivityKind.IdeaPosted, "");
        _rec(alice, ActivityKind.EndorsementReceived, "");
        IOrvexIdentity.Stats memory s = _st(alice);
        assertEq(s.challengesCreated, 1);
        assertEq(s.challengesJoined, 1);
        assertEq(s.projectsProposed, 1);
        assertEq(s.ideasPosted, 1);
        assertEq(s.endorsementsReceived, 1);
        assertEq(s.points, 0, "counters carry zero points");
        assertEq(s.challengesCompleted, 0);
        assertEq(s.contributionsAccepted, 0);

        _rec(alice, ActivityKind.ChallengeCompleted, "");
        _rec(alice, ActivityKind.ContributionAccepted, "");
        s = _st(alice);
        assertEq(s.challengesCompleted, 1);
        assertEq(s.contributionsAccepted, 1);
        assertEq(s.points, identity.POINTS_CHALLENGE_COMPLETED() + identity.POINTS_CONTRIBUTION_ACCEPTED());
        assertEq(s.points, 35);
    }

    function test_RecordEmitsActivityRecorded() public {
        vm.expectEmit(true, true, false, true, address(identity));
        emit OrvexIdentity.ActivityRecorded(alice, ActivityKind.ChallengeCompleted, 20, 20);
        _rec(alice, ActivityKind.ChallengeCompleted, "");
        vm.expectEmit(true, true, false, true, address(identity));
        emit OrvexIdentity.ActivityRecorded(alice, ActivityKind.ContributionAccepted, 15, 35);
        _rec(alice, ActivityKind.ContributionAccepted, "");
        vm.expectEmit(true, true, false, true, address(identity));
        emit OrvexIdentity.ActivityRecorded(alice, ActivityKind.IdeaPosted, 0, 35);
        _rec(alice, ActivityKind.IdeaPosted, "");
    }

    function test_CountersSaturateInsteadOfReverting() public {
        // Layout assumption (Ownable2Step: 2 slots, then 4 vars, _profiles=5, _stats=6) is verified by the readback.
        bytes32 slot = keccak256(abi.encode(alice, uint256(6)));
        vm.store(address(identity), slot, bytes32(type(uint256).max));
        assertEq(_st(alice).points, type(uint32).max, "slot guess wrong");
        _rec(alice, ActivityKind.ChallengeCompleted, "solidity");
        IOrvexIdentity.Stats memory s = _st(alice);
        assertEq(s.points, type(uint32).max);
        assertEq(s.challengesCompleted, type(uint32).max);
        (, uint32[] memory counts) = identity.getSkills(alice);
        assertEq(counts.length, 1);
        assertEq(counts[0], 1);
    }

    // ------------------------------------------------------------------ skills

    function test_SkillsOnlyForVerifiedKinds() public {
        _rec(alice, ActivityKind.IdeaPosted, "design");
        _rec(alice, ActivityKind.ChallengeCreated, "design");
        _rec(alice, ActivityKind.ChallengeCompleted, "");
        (string[] memory names,) = identity.getSkills(alice);
        assertEq(names.length, 0);
    }

    function test_SkillCountsAccumulateAndAreExactBytes() public {
        _rec(alice, ActivityKind.ChallengeCompleted, "solidity");
        _rec(alice, ActivityKind.ContributionAccepted, "solidity");
        _rec(alice, ActivityKind.ChallengeCompleted, "solidity");
        _rec(alice, ActivityKind.ChallengeCompleted, "Solidity");
        (string[] memory names, uint32[] memory counts) = identity.getSkills(alice);
        assertEq(names.length, 2);
        assertEq(names[0], "solidity");
        assertEq(counts[0], 3);
        assertEq(names[1], "Solidity");
        assertEq(counts[1], 1);
    }

    function test_SkillVerifiedEvent() public {
        vm.expectEmit(true, true, false, true, address(identity));
        emit OrvexIdentity.SkillVerified(alice, keccak256(bytes("rust")), "rust", 1);
        _rec(alice, ActivityKind.ChallengeCompleted, "rust");
        vm.expectEmit(true, true, false, true, address(identity));
        emit OrvexIdentity.SkillVerified(alice, keccak256(bytes("rust")), "rust", 2);
        _rec(alice, ActivityKind.ContributionAccepted, "rust");
    }

    function test_SkillListCappedButPointsStillCount() public {
        for (uint256 i; i < 33; ++i) {
            _rec(alice, ActivityKind.ChallengeCompleted, string.concat("s", vm.toString(i)));
        }
        (string[] memory names, uint32[] memory counts) = identity.getSkills(alice);
        assertEq(names.length, identity.MAX_SKILLS());
        assertEq(counts.length, 32);
        assertEq(_st(alice).points, 33 * 20, "points keep counting past skill cap");
        // An already-listed skill still increments after the cap is reached.
        _rec(alice, ActivityKind.ChallengeCompleted, "s0");
        (, counts) = identity.getSkills(alice);
        assertEq(counts[0], 2);
    }

    // ------------------------------------------------------------------ levels

    function test_LevelThresholds() public view {
        assertEq(identity.levelOf(0), 1);
        assertEq(identity.levelOf(49), 1);
        assertEq(identity.levelOf(50), 2);
        assertEq(identity.levelOf(149), 2);
        assertEq(identity.levelOf(150), 3);
        assertEq(identity.levelOf(399), 3);
        assertEq(identity.levelOf(400), 4);
        assertEq(identity.levelOf(999), 4);
        assertEq(identity.levelOf(1000), 5);
        assertEq(identity.levelOf(type(uint32).max), 5);
    }

    function test_LevelOfUserTracksPoints() public {
        assertEq(identity.levelOfUser(alice), 1);
        for (uint256 i; i < 3; ++i) _rec(alice, ActivityKind.ChallengeCompleted, "");
        assertEq(identity.levelOfUser(alice), 2); // 60 points
        _rec(alice, ActivityKind.ContributionAccepted, "");
        assertEq(identity.levelOfUser(alice), identity.levelOf(75));
    }

    function testFuzz_LevelOf(uint32 points) public view {
        uint8 lvl = identity.levelOf(points);
        assertGe(lvl, 1);
        assertLe(lvl, 5);
        if (points < 50) assertEq(lvl, 1);
        else if (points < 150) assertEq(lvl, 2);
        else if (points < 400) assertEq(lvl, 3);
        else if (points < 1000) assertEq(lvl, 4);
        else assertEq(lvl, 5);
    }

    function testFuzz_LevelOfMonotonic(uint32 a, uint32 b) public view {
        (uint32 lo, uint32 hi) = a <= b ? (a, b) : (b, a);
        assertLe(identity.levelOf(lo), identity.levelOf(hi));
    }

    // ------------------------------------------------------------------ participants + pagination

    function test_ParticipantsDeduped() public {
        _rec(alice, ActivityKind.IdeaPosted, "");
        _rec(bob, ActivityKind.IdeaPosted, "");
        _rec(alice, ActivityKind.ChallengeCreated, "");
        assertEq(identity.participantCount(), 2);
        address[] memory u = identity.listParticipants(0, 10);
        assertEq(u.length, 2);
        assertEq(u[0], alice);
        assertEq(u[1], bob);
        (address[] memory users, IOrvexIdentity.Stats[] memory stats) = identity.listParticipantStats(0, 10);
        assertEq(users.length, 2);
        assertEq(stats[0].ideasPosted, 1);
        assertEq(stats[0].challengesCreated, 1);
        assertEq(stats[1].ideasPosted, 1);
    }

    function test_ProfileAloneDoesNotMakeParticipant() public {
        vm.prank(alice);
        identity.setProfile("Alice", "", "", "");
        assertEq(identity.participantCount(), 0);
    }

    function test_PaginationClampsAndOutOfRange() public {
        _seed(55);
        assertEq(identity.participantCount(), 55);
        assertEq(identity.listParticipants(0, 1000).length, 50, "limit clamped to MAX_PAGE");
        assertEq(identity.listParticipants(50, 1000).length, 5);
        assertEq(identity.listParticipants(55, 1).length, 0);
        assertEq(identity.listParticipants(56, 1).length, 0);
        assertEq(identity.listParticipants(type(uint256).max, type(uint256).max).length, 0);
        assertEq(identity.listParticipants(0, 0).length, 0);
        (address[] memory users, IOrvexIdentity.Stats[] memory st) = identity.listParticipantStats(0, 1000);
        assertEq(users.length, 50);
        assertEq(st.length, 50);
        (users, st) = identity.listParticipantStats(type(uint256).max, 5);
        assertEq(users.length, 0);
        assertEq(st.length, 0);
    }

    function testFuzz_ListParticipantsPagination(uint256 offset, uint256 limit) public {
        _seed(60);
        address[] memory u = identity.listParticipants(offset, limit);
        uint256 expected = offset >= 60 ? 0 : _min(_min(limit, 50), 60 - offset);
        assertEq(u.length, expected);
        assertLe(u.length, 50);
        if (expected > 0) {
            assertEq(u[0], address(uint160(0x1000 + offset)));
            assertEq(u[expected - 1], address(uint160(0x1000 + offset + expected - 1)));
        }
    }

    function testFuzz_ListParticipantStatsPaginationBounded(uint8 offset, uint8 limit) public {
        _seed(60);
        (address[] memory u, IOrvexIdentity.Stats[] memory s) = identity.listParticipantStats(offset, limit);
        uint256 expected = offset >= 60 ? 0 : _min(_min(limit, 50), 60 - uint256(offset));
        assertEq(u.length, expected);
        assertEq(s.length, expected);
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
