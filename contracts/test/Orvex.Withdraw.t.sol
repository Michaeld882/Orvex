// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {OrvexTestBase} from "./Orvex.Base.t.sol";
import {OrvexLaunchpad} from "../OrvexLaunchpad.sol";
import {IOrvexIdentity} from "../interfaces/IOrvex.sol";

contract OrvexWithdrawTest is OrvexTestBase {
    uint64 internal pid;

    function setUp() public override {
        super.setUp();
        pid = _newProject();
    }

    function _withdraw(uint64 cid, address who) internal {
        vm.prank(who);
        launchpad.withdrawContribution(cid);
    }

    function _status(uint64 cid) internal view returns (uint8) {
        return uint8(launchpad.getContribution(cid).status);
    }

    function _setStage(OrvexLaunchpad.Stage s) internal {
        vm.prank(alice);
        launchpad.setStage(pid, s);
    }

    // ------------------------------------------------------------------ enum

    function test_WithdrawnIsValueThreeAfterRejected() public pure {
        assertEq(uint8(OrvexLaunchpad.ReviewStatus.Pending), 0);
        assertEq(uint8(OrvexLaunchpad.ReviewStatus.Accepted), 1);
        assertEq(uint8(OrvexLaunchpad.ReviewStatus.Rejected), 2);
        assertEq(uint8(OrvexLaunchpad.ReviewStatus.Withdrawn), 3);
    }

    // ------------------------------------------------------------------ happy path

    function test_WithdrawSetsStatusAndReviewedAt() public {
        uint64 cid = _contribute(pid, bob);
        vm.warp(T0 + 123);
        _withdraw(cid, bob);
        OrvexLaunchpad.Contribution memory c = launchpad.getContribution(cid);
        assertEq(uint8(c.status), 3);
        assertEq(c.reviewedAt, T0 + 123);
        assertEq(c.contributor, bob);
        assertEq(c.projectId, pid);
        assertEq(c.submittedAt, T0);
        assertEq(c.title, "My contribution");
        assertEq(c.uri, "ipfs://bafyfoo");
    }

    function test_WithdrawEmitsEvent() public {
        uint64 cid = _contribute(pid, bob);
        vm.expectEmit(true, true, true, true, address(launchpad));
        emit OrvexLaunchpad.ContributionWithdrawn(cid, pid, bob);
        _withdraw(cid, bob);
    }

    function test_WithdrawDoesNotChangeProjectCountersOrIds() public {
        uint64 cid = _contribute(pid, bob);
        OrvexLaunchpad.Project memory before_ = launchpad.getProject(pid);
        _withdraw(cid, bob);
        OrvexLaunchpad.Project memory after_ = launchpad.getProject(pid);
        assertEq(after_.contributions, before_.contributions, "history keeps the submission");
        assertEq(after_.accepted, before_.accepted);
        assertEq(launchpad.contributionCount(), 1);
        assertEq(launchpad.listProjectContributionIds(pid, 0, 10).length, 1);
    }

    // ------------------------------------------------------------------ pending slot release

    function test_WithdrawFreesPendingSlot() public {
        uint64 c1 = _contribute(pid, bob);
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.TooManyPending.selector);
        launchpad.submitContribution(pid, "Second one", "ipfs://bafybar");
        _withdraw(c1, bob);
        uint64 c2 = _contribute(pid, bob);
        assertEq(c2, c1 + 1);
        assertEq(_status(c2), 0);
        assertEq(_status(c1), 3);
        // slot is consumed again
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.TooManyPending.selector);
        launchpad.submitContribution(pid, "Third one", "ipfs://bafybaz");
    }

    function test_WithdrawSlotIsPerProjectAndPerContributor() public {
        uint64 pid2 = _newProject();
        uint64 c1 = _contribute(pid, bob);
        uint64 c2 = _contribute(pid2, bob);
        uint64 c3 = _contribute(pid, carol);
        _withdraw(c1, bob);
        // other project / contributor slots untouched
        assertEq(_status(c2), 0);
        assertEq(_status(c3), 0);
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.TooManyPending.selector);
        launchpad.submitContribution(pid2, "Another one", "ipfs://bafybar");
        vm.prank(carol);
        vm.expectRevert(OrvexLaunchpad.TooManyPending.selector);
        launchpad.submitContribution(pid, "Another one", "ipfs://bafybar");
        _contribute(pid, bob); // freed
    }

    function test_WithdrawnWorkCanBeResubmittedAndAccepted() public {
        uint64 c1 = _contribute(pid, bob);
        _withdraw(c1, bob);
        uint64 c2 = _contribute(pid, bob);
        _reviewContribution(c2, true);
        assertEq(_st(bob).contributionsAccepted, 1);
        assertEq(proof.userContributionCount(bob), 1);
    }

    // ------------------------------------------------------------------ no proof / reputation

    function test_WithdrawAwardsNoProofOrReputation() public {
        uint64 cid = _contribute(pid, bob);
        IOrvexIdentity.Stats memory sBefore = _st(bob);
        IOrvexIdentity.Stats memory aBefore = _st(alice);
        uint64 proofsBefore = proof.contributionCount();
        _withdraw(cid, bob);
        IOrvexIdentity.Stats memory sAfter = _st(bob);
        assertEq(abi.encode(sAfter), abi.encode(sBefore), "contributor stats unchanged");
        assertEq(abi.encode(_st(alice)), abi.encode(aBefore), "owner stats unchanged");
        assertEq(sAfter.points, 0);
        assertEq(sAfter.contributionsAccepted, 0);
        assertEq(proof.contributionCount(), proofsBefore);
        assertEq(proof.userContributionCount(bob), 0);
        assertEq(proof.userContributionCount(alice), 0);
    }

    // ------------------------------------------------------------------ project stages

    function test_WithdrawWorksOnPausedProject() public {
        uint64 cid = _contribute(pid, bob);
        _setStage(OrvexLaunchpad.Stage.Paused);
        _withdraw(cid, bob);
        assertEq(_status(cid), 3);
        // can submit again to a paused project (not archived)
        _contribute(pid, bob);
    }

    function test_WithdrawWorksOnArchivedProject() public {
        uint64 cid = _contribute(pid, bob);
        _setStage(OrvexLaunchpad.Stage.Archived);
        _withdraw(cid, bob);
        assertEq(_status(cid), 3);
        // archived projects still refuse new submissions
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.ProjectArchived.selector);
        launchpad.submitContribution(pid, "Another one", "ipfs://bafybar");
    }

    // ------------------------------------------------------------------ owner interaction

    function test_OwnerCannotReviewWithdrawn() public {
        uint64 cid = _contribute(pid, bob);
        _withdraw(cid, bob);
        vm.prank(alice);
        vm.expectRevert(OrvexLaunchpad.ContributionNotPending.selector);
        launchpad.reviewContribution(cid, true);
        vm.prank(alice);
        vm.expectRevert(OrvexLaunchpad.ContributionNotPending.selector);
        launchpad.reviewContribution(cid, false);
        assertEq(_status(cid), 3);
        assertEq(launchpad.getProject(pid).accepted, 0);
        assertEq(proof.contributionCount(), 0);
    }

    function test_OwnerCannotReviewWithdrawnOnArchivedProject() public {
        uint64 cid = _contribute(pid, bob);
        _setStage(OrvexLaunchpad.Stage.Archived);
        _withdraw(cid, bob);
        vm.prank(alice);
        vm.expectRevert(OrvexLaunchpad.ContributionNotPending.selector);
        launchpad.reviewContribution(cid, true);
    }

    function test_OwnerCannotWithdrawOthersWork() public {
        uint64 cid = _contribute(pid, bob);
        vm.prank(alice);
        vm.expectRevert(OrvexLaunchpad.NotContributor.selector);
        launchpad.withdrawContribution(cid);
        assertEq(_status(cid), 0);
    }

    function test_OtherUserCannotWithdraw() public {
        uint64 cid = _contribute(pid, bob);
        vm.prank(carol);
        vm.expectRevert(OrvexLaunchpad.NotContributor.selector);
        launchpad.withdrawContribution(cid);
        assertEq(_status(cid), 0);
    }

    // ------------------------------------------------------------------ revert paths

    function test_UnknownContributionReverts() public {
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.UnknownContribution.selector);
        launchpad.withdrawContribution(0);
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.UnknownContribution.selector);
        launchpad.withdrawContribution(1);
        uint64 cid = _contribute(pid, bob);
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.UnknownContribution.selector);
        launchpad.withdrawContribution(cid + 1);
    }

    function test_DoubleWithdrawReverts() public {
        uint64 cid = _contribute(pid, bob);
        _withdraw(cid, bob);
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.ContributionNotPending.selector);
        launchpad.withdrawContribution(cid);
    }

    function test_DoubleWithdrawDoesNotUnderflowOrGrantExtraSlot() public {
        uint64 c1 = _contribute(pid, bob);
        _withdraw(c1, bob);
        uint64 c2 = _contribute(pid, bob);
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.ContributionNotPending.selector);
        launchpad.withdrawContribution(c1);
        // still exactly one pending slot used
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.TooManyPending.selector);
        launchpad.submitContribution(pid, "Third one", "ipfs://bafybaz");
        assertEq(_status(c2), 0);
    }

    function test_WithdrawAfterAcceptReverts() public {
        uint64 cid = _contribute(pid, bob);
        _reviewContribution(cid, true);
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.ContributionNotPending.selector);
        launchpad.withdrawContribution(cid);
        assertEq(_status(cid), 1);
        assertEq(_st(bob).contributionsAccepted, 1);
    }

    function test_WithdrawAfterRejectReverts() public {
        uint64 cid = _contribute(pid, bob);
        _reviewContribution(cid, false);
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.ContributionNotPending.selector);
        launchpad.withdrawContribution(cid);
        assertEq(_status(cid), 2);
    }

    function test_NonContributorCheckPrecedesPendingCheck() public {
        uint64 cid = _contribute(pid, bob);
        _reviewContribution(cid, true);
        vm.prank(carol);
        vm.expectRevert(OrvexLaunchpad.NotContributor.selector);
        launchpad.withdrawContribution(cid);
    }

    // ------------------------------------------------------------------ fuzz

    /// @dev PROPERTY: any contributor can always withdraw their own pending work, releasing the slot
    /// without any proof or reputation change.
    function testFuzz_WithdrawReleasesSlotNoRewards(address who, uint8 stageRaw, uint256 delay) public {
        vm.assume(who != alice && who != address(0) && who != address(launchpad));
        OrvexLaunchpad.Stage st = OrvexLaunchpad.Stage(bound(stageRaw, 0, 5));
        delay = bound(delay, 0, 365 days);
        uint64 cid = _contribute(pid, who);
        _setStage(st);
        skip(delay);
        IOrvexIdentity.Stats memory before_ = _st(who);
        _withdraw(cid, who);
        assertEq(abi.encode(_st(who)), abi.encode(before_));
        assertEq(proof.contributionCount(), 0);
        OrvexLaunchpad.Contribution memory c = launchpad.getContribution(cid);
        assertEq(uint8(c.status), 3);
        assertEq(c.reviewedAt, block.timestamp);
        if (st != OrvexLaunchpad.Stage.Archived) {
            _contribute(pid, who);
        }
    }
}
