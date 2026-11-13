// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {OrvexTestBase} from "./Orvex.Base.t.sol";
import {OrvexLaunchpad} from "../OrvexLaunchpad.sol";
import {OrvexText} from "../libraries/OrvexText.sol";
import {IOrvexIdentity, IOrvexProof} from "../interfaces/IOrvex.sol";

contract OrvexLaunchpadTest is OrvexTestBase {
    function _setStage(uint64 id, OrvexLaunchpad.Stage st) internal {
        vm.prank(alice);
        launchpad.setStage(id, st);
    }

    // ------------------------------------------------------------------ constructor + propose

    function test_ConstructorRejectsZeroSiblings() public {
        vm.expectRevert(OrvexLaunchpad.ZeroAddress.selector);
        new OrvexLaunchpad(IOrvexIdentity(address(0)), proof);
        vm.expectRevert(OrvexLaunchpad.ZeroAddress.selector);
        new OrvexLaunchpad(identity, IOrvexProof(address(0)));
    }

    function test_ProposeHappy() public {
        vm.expectEmit(true, true, false, true, address(launchpad));
        emit OrvexLaunchpad.ProjectProposed(1, alice, "Cool Project");
        vm.prank(alice);
        uint64 id = launchpad.proposeProject("Cool Project", "A tagline", "A long description", "defi", "https://cool.io");
        assertEq(id, 1);
        assertEq(launchpad.projectCount(), 1);
        OrvexLaunchpad.Project memory p = launchpad.getProject(1);
        assertEq(p.id, 1);
        assertEq(p.owner, alice);
        assertEq(uint8(p.stage), uint8(OrvexLaunchpad.Stage.Idea));
        assertEq(p.createdAt, T0);
        assertEq(p.updatedAt, T0);
        assertEq(p.contributions, 0);
        assertEq(p.accepted, 0);
        assertEq(p.updates, 0);
        assertEq(p.name, "Cool Project");
        assertEq(p.tagline, "A tagline");
        assertEq(p.description, "A long description");
        assertEq(p.category, "defi");
        assertEq(p.link, "https://cool.io");
        assertEq(launchpad.ownedCount(alice), 1);
        assertEq(launchpad.listOwnedIds(alice, 0, 10)[0], 1);
        assertEq(_st(alice).projectsProposed, 1);
        assertEq(_st(alice).points, 0);
    }

    function test_ProposeEmptyLinkAllowedAndIpfsLink() public {
        _tryPropose(10, 20, 30, 8, "");
        _tryPropose(10, 20, 30, 8, "ipfs://bafy");
        assertEq(launchpad.getProject(1).link, "");
        assertEq(launchpad.projectCount(), 2);
    }

    function test_ProposeLengthBoundariesAccepted() public {
        _tryPropose(3, 5, 10, 1, "");
        _tryPropose(48, 100, 1000, 24, _link(200));
        assertEq(launchpad.projectCount(), 2);
    }

    function test_ProposeRevertsOnEveryLengthBound() public {
        vm.expectRevert(_lenErr(2, 3, 48));
        _tryPropose(2, 20, 30, 8, "");
        vm.expectRevert(_lenErr(49, 3, 48));
        _tryPropose(49, 20, 30, 8, "");
        vm.expectRevert(_lenErr(4, 5, 100));
        _tryPropose(10, 4, 30, 8, "");
        vm.expectRevert(_lenErr(101, 5, 100));
        _tryPropose(10, 101, 30, 8, "");
        vm.expectRevert(_lenErr(9, 10, 1000));
        _tryPropose(10, 20, 9, 8, "");
        vm.expectRevert(_lenErr(1001, 10, 1000));
        _tryPropose(10, 20, 1001, 8, "");
        vm.expectRevert(_lenErr(0, 1, 24));
        _tryPropose(10, 20, 30, 0, "");
        vm.expectRevert(_lenErr(25, 1, 24));
        _tryPropose(10, 20, 30, 25, "");
        vm.expectRevert(_lenErr(201, 0, 200));
        _tryPropose(10, 20, 30, 8, _link(201));
        assertEq(launchpad.projectCount(), 0);
    }

    function test_ProposeRevertsOnBadLink() public {
        vm.expectRevert(OrvexText.InvalidLink.selector);
        _tryPropose(10, 20, 30, 8, "http://insecure.io");
        vm.expectRevert(OrvexText.InvalidLink.selector);
        _tryPropose(10, 20, 30, 8, "example.com");
    }

    // ------------------------------------------------------------------ stage

    function test_SetStageAllStagesAndEvent() public {
        uint64 id = _newProject();
        for (uint8 i = 1; i <= 4; ++i) {
            skip(1);
            vm.expectEmit(true, false, false, true, address(launchpad));
            emit OrvexLaunchpad.StageChanged(id, OrvexLaunchpad.Stage(i));
            _setStage(id, OrvexLaunchpad.Stage(i));
            assertEq(uint8(launchpad.getProject(id).stage), i);
        }
        // moving back is allowed until archived
        _setStage(id, OrvexLaunchpad.Stage.Idea);
        assertEq(launchpad.getProject(id).updatedAt, T0 + 4);
    }

    function test_SetStageNonOwnerReverts() public {
        uint64 id = _newProject();
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.NotProjectOwner.selector);
        launchpad.setStage(id, OrvexLaunchpad.Stage.Live);
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.UnknownProject.selector);
        launchpad.setStage(0, OrvexLaunchpad.Stage.Live);
    }

    function test_ArchivedIsTerminal() public {
        uint64 id = _newProject();
        _setStage(id, OrvexLaunchpad.Stage.Archived);
        vm.prank(alice);
        vm.expectRevert(OrvexLaunchpad.ProjectArchived.selector);
        launchpad.setStage(id, OrvexLaunchpad.Stage.Live);
        vm.prank(alice);
        vm.expectRevert(OrvexLaunchpad.ProjectArchived.selector);
        launchpad.setStage(id, OrvexLaunchpad.Stage.Archived);
        vm.prank(alice);
        vm.expectRevert(OrvexLaunchpad.ProjectArchived.selector);
        launchpad.postUpdate(id, "hello");
        vm.expectRevert(OrvexLaunchpad.ProjectArchived.selector);
        _contribute(id, bob);
    }

    // ------------------------------------------------------------------ updates

    function test_PostUpdateHappy() public {
        uint64 id = _newProject();
        _setStage(id, OrvexLaunchpad.Stage.Beta);
        skip(30);
        vm.expectEmit(true, false, false, true, address(launchpad));
        emit OrvexLaunchpad.ProjectUpdated(id, 0);
        vm.prank(alice);
        launchpad.postUpdate(id, "Shipped beta");
        vm.expectEmit(true, false, false, true, address(launchpad));
        emit OrvexLaunchpad.ProjectUpdated(id, 1);
        vm.prank(alice);
        launchpad.postUpdate(id, "Second");
        OrvexLaunchpad.Project memory p = launchpad.getProject(id);
        assertEq(p.updates, 2);
        assertEq(p.updatedAt, T0 + 30);
        OrvexLaunchpad.ProjectUpdate[] memory u = launchpad.listUpdates(id, 0, 10);
        assertEq(u.length, 2);
        assertEq(u[0].text, "Shipped beta");
        assertEq(u[0].at, T0 + 30);
        assertEq(uint8(u[0].stage), uint8(OrvexLaunchpad.Stage.Beta));
        assertEq(u[1].text, "Second");
    }

    function test_PostUpdateAccessAndBounds() public {
        uint64 id = _newProject();
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.NotProjectOwner.selector);
        launchpad.postUpdate(id, "hello");
        vm.prank(alice);
        vm.expectRevert(OrvexLaunchpad.UnknownProject.selector);
        launchpad.postUpdate(2, "hello");
        vm.startPrank(alice);
        vm.expectRevert(_lenErr(2, 3, 280));
        launchpad.postUpdate(id, _s(2));
        vm.expectRevert(_lenErr(281, 3, 280));
        launchpad.postUpdate(id, _s(281));
        launchpad.postUpdate(id, _s(3));
        launchpad.postUpdate(id, _s(280));
        vm.stopPrank();
        assertEq(launchpad.getProject(id).updates, 2);
    }

    function test_PostUpdateCappedAt100() public {
        uint64 id = _newProject();
        vm.startPrank(alice);
        for (uint256 i; i < 100; ++i) launchpad.postUpdate(id, "update");
        vm.expectRevert(OrvexLaunchpad.TooManyUpdates.selector);
        launchpad.postUpdate(id, "one too many");
        vm.stopPrank();
        assertEq(launchpad.MAX_UPDATES(), 100);
        assertEq(launchpad.getProject(id).updates, 100);
        assertEq(launchpad.listUpdates(id, 0, 1000).length, 50);
        assertEq(launchpad.listUpdates(id, 50, 1000).length, 50);
        assertEq(launchpad.listUpdates(id, 100, 1).length, 0);
        assertEq(launchpad.listUpdates(id, type(uint256).max, 1).length, 0);
    }

    // ------------------------------------------------------------------ contributions

    function test_SubmitContributionHappy() public {
        uint64 pid = _newProject();
        skip(5);
        vm.expectEmit(true, true, true, false, address(launchpad));
        emit OrvexLaunchpad.ContributionSubmitted(1, pid, bob);
        uint64 cid = _contribute(pid, bob);
        assertEq(cid, 1);
        assertEq(launchpad.contributionCount(), 1);
        OrvexLaunchpad.Contribution memory c = launchpad.getContribution(cid);
        assertEq(c.id, 1);
        assertEq(c.projectId, pid);
        assertEq(c.contributor, bob);
        assertEq(uint8(c.status), uint8(OrvexLaunchpad.ReviewStatus.Pending));
        assertEq(c.submittedAt, T0 + 5);
        assertEq(c.reviewedAt, 0);
        assertEq(c.title, "My contribution");
        assertEq(c.uri, "ipfs://bafyfoo");
        assertEq(launchpad.getProject(pid).contributions, 1);
        assertEq(launchpad.listProjectContributionIds(pid, 0, 10)[0], 1);
        // submission alone earns nothing
        assertEq(_st(bob).points, 0);
        assertEq(proof.contributionCount(), 0);
    }

    function test_OwnerCannotContribute() public {
        uint64 pid = _newProject();
        vm.expectRevert(OrvexLaunchpad.OwnerCannotContribute.selector);
        _contribute(pid, alice);
    }

    function test_ContributeToUnknownProjectReverts() public {
        vm.expectRevert(OrvexLaunchpad.UnknownProject.selector);
        _contribute(0, bob);
        vm.expectRevert(OrvexLaunchpad.UnknownProject.selector);
        _contribute(1, bob);
    }

    function test_ContributeToPausedProjectAllowed() public {
        uint64 pid = _newProject();
        _setStage(pid, OrvexLaunchpad.Stage.Paused);
        _contribute(pid, bob);
        assertEq(launchpad.contributionCount(), 1);
    }

    function test_OnlyOnePendingPerContributorPerProject() public {
        uint64 pid = _newProject();
        uint64 pid2 = _newProject();
        uint64 c1 = _contribute(pid, bob);
        assertEq(launchpad.MAX_PENDING(), 1);
        vm.expectRevert(OrvexLaunchpad.TooManyPending.selector);
        _contribute(pid, bob);
        // different contributor and different project are independent
        _contribute(pid, carol);
        _contribute(pid2, bob);
        // after review, bob may submit again to the same project
        _reviewContribution(c1, false);
        _contribute(pid, bob);
        assertEq(launchpad.getProject(pid).contributions, 3);
    }

    function test_SubmitContributionBadInputs() public {
        uint64 pid = _newProject();
        vm.startPrank(bob);
        vm.expectRevert(_lenErr(2, 3, 80));
        launchpad.submitContribution(pid, _s(2), "https://x.io");
        vm.expectRevert(_lenErr(81, 3, 80));
        launchpad.submitContribution(pid, _s(81), "https://x.io");
        vm.expectRevert(_lenErr(0, 1, 200));
        launchpad.submitContribution(pid, "Title", "");
        vm.expectRevert(_lenErr(201, 1, 200));
        launchpad.submitContribution(pid, "Title", _link(201));
        vm.expectRevert(OrvexText.InvalidLink.selector);
        launchpad.submitContribution(pid, "Title", "http://x.io");
        launchpad.submitContribution(pid, _s(80), _link(200));
        vm.stopPrank();
        assertEq(launchpad.contributionCount(), 1);
    }

    // ------------------------------------------------------------------ review

    function test_AcceptRecordsProofAndReputation() public {
        uint64 pid = _newProject();
        uint64 cid = _contribute(pid, bob);
        skip(10);
        vm.expectEmit(true, true, true, true, address(launchpad));
        emit OrvexLaunchpad.ContributionReviewed(cid, pid, alice, true);
        _reviewContribution(cid, true);
        OrvexLaunchpad.Contribution memory c = launchpad.getContribution(cid);
        assertEq(uint8(c.status), uint8(OrvexLaunchpad.ReviewStatus.Accepted));
        assertEq(c.reviewedAt, T0 + 10);
        assertEq(launchpad.getProject(pid).accepted, 1);

        assertEq(proof.contributionCount(), 1);
        IOrvexProof.Contribution memory r = proof.getContribution(1);
        assertEq(r.contributor, bob);
        assertEq(r.attestor, alice);
        assertEq(uint8(r.source), uint8(IOrvexProof.Source.Project));
        assertEq(r.sourceId, pid);
        assertEq(r.title, "My contribution");
        assertEq(r.uri, "ipfs://bafyfoo");
        assertTrue(proof.verifyRecord(1, r.digest));

        assertEq(_st(bob).contributionsAccepted, 1);
        assertEq(_st(bob).points, 15);
        (string[] memory names, uint32[] memory counts) = identity.getSkills(bob);
        assertEq(names.length, 1);
        assertEq(names[0], _s(8), "skill = project category");
        assertEq(counts[0], 1);
        assertEq(_st(alice).points, 0, "owner earns no points for accepting");
    }

    function test_RejectGivesNothing() public {
        uint64 pid = _newProject();
        uint64 cid = _contribute(pid, bob);
        vm.expectEmit(true, true, true, true, address(launchpad));
        emit OrvexLaunchpad.ContributionReviewed(cid, pid, alice, false);
        _reviewContribution(cid, false);
        assertEq(uint8(launchpad.getContribution(cid).status), uint8(OrvexLaunchpad.ReviewStatus.Rejected));
        assertEq(launchpad.getProject(pid).accepted, 0);
        assertEq(proof.contributionCount(), 0);
        assertEq(_st(bob).points, 0);
    }

    function test_ReviewAccessAndStateReverts() public {
        uint64 pid = _newProject();
        uint64 cid = _contribute(pid, bob);
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.NotProjectOwner.selector);
        launchpad.reviewContribution(cid, true); // contributor self-approve
        vm.prank(carol);
        vm.expectRevert(OrvexLaunchpad.NotProjectOwner.selector);
        launchpad.reviewContribution(cid, false);
        vm.prank(alice);
        vm.expectRevert(OrvexLaunchpad.UnknownContribution.selector);
        launchpad.reviewContribution(0, true);
        vm.prank(alice);
        vm.expectRevert(OrvexLaunchpad.UnknownContribution.selector);
        launchpad.reviewContribution(cid + 1, true);
        _reviewContribution(cid, true);
        vm.prank(alice);
        vm.expectRevert(OrvexLaunchpad.ContributionNotPending.selector);
        launchpad.reviewContribution(cid, true);
        assertEq(_st(bob).points, 15, "no double award");
    }

    function test_ReviewAllowedAfterArchive() public {
        uint64 pid = _newProject();
        uint64 cid = _contribute(pid, bob);
        _setStage(pid, OrvexLaunchpad.Stage.Archived);
        _reviewContribution(cid, true);
        assertEq(_st(bob).points, 15);
    }

    function test_ReviewByOwnerOfAnotherProjectReverts() public {
        uint64 pid = _newProject();
        uint64 cid = _contribute(pid, carol);
        vm.prank(bob);
        launchpad.proposeProject("Bob Project", "tagline", "description text", "cat", "");
        vm.prank(bob);
        vm.expectRevert(OrvexLaunchpad.NotProjectOwner.selector);
        launchpad.reviewContribution(cid, true);
    }

    // ------------------------------------------------------------------ views

    function test_UnknownProjectViewsRevert() public {
        vm.expectRevert(OrvexLaunchpad.UnknownProject.selector);
        launchpad.getProject(0);
        vm.expectRevert(OrvexLaunchpad.UnknownProject.selector);
        launchpad.getProject(1);
        vm.expectRevert(OrvexLaunchpad.UnknownProject.selector);
        launchpad.listUpdates(1, 0, 10);
        vm.expectRevert(OrvexLaunchpad.UnknownProject.selector);
        launchpad.listProjectContributionIds(1, 0, 10);
        vm.expectRevert(OrvexLaunchpad.UnknownContribution.selector);
        launchpad.getContribution(1);
    }

    function test_ListProjectsPaginationClamps() public {
        for (uint256 i; i < 55; ++i) _newProject();
        assertEq(launchpad.listProjects(0, 1000).length, 50);
        assertEq(launchpad.listProjects(50, 1000).length, 5);
        assertEq(launchpad.listProjects(55, 1).length, 0);
        assertEq(launchpad.listProjects(type(uint256).max, type(uint256).max).length, 0);
        assertEq(launchpad.listProjects(0, 0).length, 0);
        assertEq(launchpad.listProjects(4, 1)[0].id, 5);
        assertEq(launchpad.listOwnedIds(alice, 0, 1000).length, 50);
        assertEq(launchpad.listOwnedIds(alice, 54, 1000).length, 1);
        assertEq(launchpad.listOwnedIds(alice, 55, 1000).length, 0);
        assertEq(launchpad.listOwnedIds(bob, 0, 10).length, 0);
        assertEq(launchpad.ownedCount(alice), 55);
    }

    function test_ListProjectContributionIdsPagination() public {
        uint64 pid = _newProject();
        for (uint256 i; i < 52; ++i) _contribute(pid, address(uint160(0x7000 + i)));
        assertEq(launchpad.listProjectContributionIds(pid, 0, 1000).length, 50);
        assertEq(launchpad.listProjectContributionIds(pid, 50, 1000).length, 2);
        assertEq(launchpad.listProjectContributionIds(pid, 52, 1).length, 0);
        assertEq(launchpad.listProjectContributionIds(pid, type(uint256).max, 1).length, 0);
    }

    function testFuzz_ListProjectsPagination(uint256 offset, uint256 limit) public {
        for (uint256 i; i < 7; ++i) _newProject();
        OrvexLaunchpad.Project[] memory items = launchpad.listProjects(offset, limit);
        uint256 cap = limit > 50 ? 50 : limit;
        uint256 expected = offset >= 7 ? 0 : (cap < 7 - offset ? cap : 7 - offset);
        assertEq(items.length, expected);
        if (expected > 0) assertEq(items[0].id, offset + 1);
        assertEq(launchpad.listOwnedIds(alice, offset, limit).length, expected);
        assertEq(launchpad.listUpdates(1, offset, limit).length, 0);
    }
}
