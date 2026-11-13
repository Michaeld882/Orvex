// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {OrvexIdentity} from "../OrvexIdentity.sol";
import {OrvexProof} from "../OrvexProof.sol";
import {OrvexChallenges} from "../OrvexChallenges.sol";
import {OrvexLaunchpad} from "../OrvexLaunchpad.sol";
import {OrvexIdeas} from "../OrvexIdeas.sol";
import {IOrvexIdentity, IOrvexProof, ActivityKind} from "../interfaces/IOrvex.sol";
import {OrvexText} from "../libraries/OrvexText.sol";

/// @dev Shared fixture: deploys all five ORVEX modules with the exact wiring of script/DeployOrvex.s.sol.
/// Contains no test functions (every category file inherits it).
abstract contract OrvexTestBase is Test {
    OrvexIdentity internal identity;
    OrvexProof internal proof;
    OrvexChallenges internal challenges;
    OrvexLaunchpad internal launchpad;
    OrvexIdeas internal ideas;

    address internal owner = makeAddr("owner");
    /// @dev alice is the default creator / project owner / idea author.
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave = makeAddr("dave");

    uint256 internal constant T0 = 1_700_000_000;

    function setUp() public virtual {
        vm.warp(T0);
        vm.startPrank(owner);
        identity = new OrvexIdentity(owner);
        proof = new OrvexProof(owner, identity);
        challenges = new OrvexChallenges(identity, proof);
        launchpad = new OrvexLaunchpad(identity, proof);
        ideas = new OrvexIdeas(identity);
        identity.setRecorder(address(challenges), true);
        identity.setRecorder(address(launchpad), true);
        identity.setRecorder(address(ideas), true);
        proof.setRecorder(address(challenges), true);
        proof.setRecorder(address(launchpad), true);
        identity.finalizeRecorders();
        proof.finalizeRecorders();
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ text helpers

    /// @dev String of exactly `n` bytes.
    function _s(uint256 n) internal pure returns (string memory) {
        bytes memory b = new bytes(n);
        for (uint256 i; i < n; ++i) b[i] = "a";
        return string(b);
    }

    /// @dev https:// link of exactly `n` bytes (n >= 8).
    function _link(uint256 n) internal pure returns (string memory) {
        bytes memory b = new bytes(n);
        bytes memory p = bytes("https://");
        for (uint256 i; i < n; ++i) b[i] = i < p.length ? p[i] : bytes1("a");
        return string(b);
    }

    function _lenErr(uint256 actual, uint256 min, uint256 max) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(OrvexText.InvalidLength.selector, actual, min, max);
    }

    function _st(address u) internal view returns (IOrvexIdentity.Stats memory) {
        return identity.statsOf(u);
    }

    // ------------------------------------------------------------------ challenge helpers (creator = alice)

    function _tryCreate(uint256 tl, uint256 dl, uint256 sl, uint256 rl, uint256 duration, uint32 maxP) internal returns (uint64) {
        vm.prank(alice);
        return challenges.createChallenge(_s(tl), _s(dl), _s(sl), _s(rl), uint40(block.timestamp + duration), maxP);
    }

    function _newChallenge() internal returns (uint64) {
        return _tryCreate(10, 20, 8, 0, 1 days, 10);
    }

    function _join(uint64 id, address u) internal {
        vm.prank(u);
        challenges.joinChallenge(id);
    }

    function _submit(uint64 id, address u) internal {
        vm.prank(u);
        challenges.submitWork(id, "https://x.io/work", "my note");
    }

    function _review(uint64 id, address u, bool ok) internal {
        vm.prank(alice);
        challenges.reviewSubmission(id, u, ok);
    }

    /// @dev join + submit + approve; returns nothing, state is observable via getters.
    function _complete(uint64 id, address u) internal {
        _join(id, u);
        _submit(id, u);
        _review(id, u, true);
    }

    // ------------------------------------------------------------------ launchpad helpers (owner = alice)

    function _tryPropose(uint256 nl, uint256 tl, uint256 dl, uint256 cl, string memory link) internal returns (uint64) {
        vm.prank(alice);
        return launchpad.proposeProject(_s(nl), _s(tl), _s(dl), _s(cl), link);
    }

    function _newProject() internal returns (uint64) {
        return _tryPropose(10, 20, 30, 8, "");
    }

    function _contribute(uint64 pid, address u) internal returns (uint64) {
        vm.prank(u);
        return launchpad.submitContribution(pid, "My contribution", "ipfs://bafyfoo");
    }

    function _reviewContribution(uint64 cid, bool ok) internal {
        vm.prank(alice);
        launchpad.reviewContribution(cid, ok);
    }

    // ------------------------------------------------------------------ ideas helpers (author = alice)

    function _tryPost(uint256 tl, uint256 bl, uint256 gl) internal returns (uint64) {
        vm.prank(alice);
        return ideas.postIdea(_s(tl), _s(bl), _s(gl));
    }

    function _newIdea() internal returns (uint64) {
        return _tryPost(10, 20, 5);
    }
}
