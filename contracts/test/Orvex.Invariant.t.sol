// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {OrvexTestBase} from "./Orvex.Base.t.sol";
import {OrvexChallenges} from "../OrvexChallenges.sol";
import {OrvexIdentity} from "../OrvexIdentity.sol";
import {OrvexProof} from "../OrvexProof.sol";

/// @dev Drives bounded random sequences of challenge actions. Failed calls are swallowed so sequences keep exploring.
contract ChallengeHandler is Test {
    OrvexChallenges public immutable ch;
    address[] internal creators;
    address[] internal actors;
    /// @dev ghost: approvals this handler observed succeeding, per participant.
    mapping(address => uint256) public ghostApproved;
    uint256 public ghostTotalApproved;

    constructor(OrvexChallenges ch_, address[] memory creators_, address[] memory actors_) {
        ch = ch_;
        creators = creators_;
        actors = actors_;
    }

    function actorsLength() external view returns (uint256) {
        return actors.length;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i];
    }

    function create(uint256 cSeed, uint256 duration, uint256 maxP) external {
        address creator = creators[cSeed % creators.length];
        duration = bound(duration, 1 hours, 30 days);
        maxP = bound(maxP, 1, 20);
        vm.prank(creator);
        try ch.createChallenge("Title", "A description!", "skill", "", uint40(block.timestamp + duration), uint32(maxP)) {} catch {}
    }

    function join(uint256 idSeed, uint256 aSeed) external {
        uint64 n = ch.challengeCount();
        if (n == 0) return;
        vm.prank(actors[aSeed % actors.length]);
        try ch.joinChallenge(uint64(bound(idSeed, 1, n))) {} catch {}
    }

    function submit(uint256 idSeed, uint256 aSeed) external {
        uint64 n = ch.challengeCount();
        if (n == 0) return;
        vm.prank(actors[aSeed % actors.length]);
        try ch.submitWork(uint64(bound(idSeed, 1, n)), "https://x.io/w", "n") {} catch {}
    }

    function review(uint256 idSeed, uint256 aSeed, bool approve) external {
        uint64 n = ch.challengeCount();
        if (n == 0) return;
        uint64 id = uint64(bound(idSeed, 1, n));
        address actor = actors[aSeed % actors.length];
        vm.prank(ch.getChallenge(id).creator);
        try ch.reviewSubmission(id, actor, approve) {
            if (approve) {
                ++ghostApproved[actor];
                ++ghostTotalApproved;
            }
        } catch {}
    }

    function close(uint256 idSeed) external {
        uint64 n = ch.challengeCount();
        if (n == 0) return;
        uint64 id = uint64(bound(idSeed, 1, n));
        vm.prank(ch.getChallenge(id).creator);
        try ch.closeChallenge(id) {} catch {}
    }

    function cancel(uint256 idSeed) external {
        uint64 n = ch.challengeCount();
        if (n == 0) return;
        uint64 id = uint64(bound(idSeed, 1, n));
        vm.prank(ch.getChallenge(id).creator);
        try ch.cancelChallenge(id) {} catch {}
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 0, 3 days));
    }
}

/// forge-config: default.invariant.runs = 64
/// forge-config: default.invariant.depth = 150
contract OrvexInvariantTest is OrvexTestBase {
    ChallengeHandler internal handler;

    function setUp() public override {
        super.setUp();
        address[] memory creators = new address[](2);
        creators[0] = alice;
        creators[1] = bob;
        address[] memory actors = new address[](4);
        actors[0] = bob;
        actors[1] = carol;
        actors[2] = dave;
        actors[3] = alice;
        handler = new ChallengeHandler(challenges, creators, actors);
        targetContract(address(handler));
    }

    /// @dev Guards against a vacuous invariant: the handler's happy path really reaches an approval.
    function test_HandlerReachesApproval() public {
        handler.create(0, 1 days, 5); // creator alice
        handler.join(1, 1); // carol
        handler.submit(1, 1);
        handler.review(1, 1, true);
        assertEq(handler.ghostTotalApproved(), 1);
        assertEq(identity.statsOf(carol).challengesCompleted, 1);
        assertEq(identity.statsOf(carol).points, 20);
    }

    function _approvedOnChain(address u) internal view returns (uint256 n) {
        uint64 count = challenges.challengeCount();
        for (uint64 id = 1; id <= count; ++id) {
            if (challenges.getSubmission(id, u).status == OrvexChallenges.SubmissionStatus.Approved) ++n;
        }
    }

    /// PROPERTY: a user's challengesCompleted never exceeds their approved submissions (and in fact equals them).
    function invariant_CompletedNeverExceedsApprovedSubmissions() public view {
        for (uint256 i; i < handler.actorsLength(); ++i) {
            address u = handler.actorAt(i);
            uint32 completed = identity.statsOf(u).challengesCompleted;
            uint256 approved = _approvedOnChain(u);
            assertLe(completed, approved, "completed > approved");
            assertEq(completed, approved, "completed != approved");
            assertEq(completed, handler.ghostApproved(u), "completed != ghost");
        }
    }

    /// PROPERTY: points come only from approvals; proofs and per-challenge approved counters agree.
    function invariant_PointsProofsAndCountersAgree() public view {
        uint256 sumCompleted;
        for (uint256 i; i < handler.actorsLength(); ++i) {
            address u = handler.actorAt(i);
            sumCompleted += identity.statsOf(u).challengesCompleted;
            assertEq(identity.statsOf(u).points, uint256(identity.statsOf(u).challengesCompleted) * 20);
            assertEq(proof.userContributionCount(u), identity.statsOf(u).challengesCompleted);
        }
        uint256 sumApprovedCounters;
        uint64 count = challenges.challengeCount();
        for (uint64 id = 1; id <= count; ++id) {
            OrvexChallenges.Challenge memory c = challenges.getChallenge(id);
            sumApprovedCounters += c.approved;
            assertLe(c.participants, c.maxParticipants);
            assertLe(c.submissions, c.participants);
        }
        assertEq(sumCompleted, sumApprovedCounters);
        assertEq(sumCompleted, proof.contributionCount());
        assertEq(sumCompleted, handler.ghostTotalApproved());
    }

    /// PROPERTY: no attempt counter ever exceeds MAX_ATTEMPTS.
    function invariant_AttemptsBounded() public view {
        uint64 count = challenges.challengeCount();
        for (uint64 id = 1; id <= count; ++id) {
            for (uint256 i; i < handler.actorsLength(); ++i) {
                assertLe(challenges.getSubmission(id, handler.actorAt(i)).attempts, challenges.MAX_ATTEMPTS());
            }
        }
    }
}
