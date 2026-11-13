// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {OrvexTestBase} from "./Orvex.Base.t.sol";
import {OrvexIdeas} from "../OrvexIdeas.sol";
import {IOrvexIdentity} from "../interfaces/IOrvex.sol";

contract OrvexIdeasTest is OrvexTestBase {
    function _endorse(uint64 id, address u) internal {
        vm.prank(u);
        ideas.endorse(id);
    }

    function test_ConstructorRejectsZeroIdentity() public {
        vm.expectRevert(OrvexIdeas.ZeroAddress.selector);
        new OrvexIdeas(IOrvexIdentity(address(0)));
    }

    // ------------------------------------------------------------------ post

    function test_PostIdeaHappy() public {
        vm.expectEmit(true, true, false, true, address(ideas));
        emit OrvexIdeas.IdeaPosted(1, alice, "Great idea");
        vm.prank(alice);
        uint64 id = ideas.postIdea("Great idea", "A body that is long enough", "infra");
        assertEq(id, 1);
        assertEq(ideas.ideaCount(), 1);
        OrvexIdeas.Idea memory i = ideas.getIdea(1);
        assertEq(i.id, 1);
        assertEq(i.author, alice);
        assertEq(i.createdAt, T0);
        assertEq(i.endorsements, 0);
        assertFalse(i.retracted);
        assertEq(i.title, "Great idea");
        assertEq(i.body, "A body that is long enough");
        assertEq(i.tag, "infra");
        assertEq(ideas.listAuthoredIds(alice, 0, 10)[0], 1);
        assertEq(_st(alice).ideasPosted, 1);
        assertEq(_st(alice).points, 0);
    }

    function test_PostLengthBoundaries() public {
        _tryPost(3, 10, 1);
        skip(10 minutes);
        _tryPost(80, 600, 24);
        assertEq(ideas.ideaCount(), 2);
    }

    function test_PostRevertsOnEveryLengthBound() public {
        vm.expectRevert(_lenErr(2, 3, 80));
        _tryPost(2, 20, 5);
        vm.expectRevert(_lenErr(81, 3, 80));
        _tryPost(81, 20, 5);
        vm.expectRevert(_lenErr(9, 10, 600));
        _tryPost(10, 9, 5);
        vm.expectRevert(_lenErr(601, 10, 600));
        _tryPost(10, 601, 5);
        vm.expectRevert(_lenErr(0, 1, 24));
        _tryPost(10, 20, 0);
        vm.expectRevert(_lenErr(25, 1, 24));
        _tryPost(10, 20, 25);
        assertEq(ideas.ideaCount(), 0);
    }

    function test_CooldownEnforcedPerAddress() public {
        _newIdea();
        assertEq(ideas.POST_COOLDOWN(), 10 minutes);
        vm.expectRevert(OrvexIdeas.CooldownActive.selector);
        _newIdea();
        skip(10 minutes - 1);
        vm.expectRevert(OrvexIdeas.CooldownActive.selector);
        _newIdea();
        // another address is unaffected
        vm.prank(bob);
        ideas.postIdea("Bob idea", "Bob's idea body", "tag");
        skip(1);
        assertEq(_newIdea(), 3);
        // cooldown restarts after each post
        vm.expectRevert(OrvexIdeas.CooldownActive.selector);
        _newIdea();
    }

    function test_CooldownCheckedBeforeValidation() public {
        _newIdea();
        vm.expectRevert(OrvexIdeas.CooldownActive.selector);
        _tryPost(1, 1, 1);
    }

    function test_FailedPostDoesNotConsumeCooldown() public {
        vm.expectRevert(_lenErr(2, 3, 80));
        _tryPost(2, 20, 5);
        _newIdea();
    }

    // ------------------------------------------------------------------ endorse

    function test_EndorseHappy() public {
        uint64 id = _newIdea();
        vm.expectEmit(true, true, true, false, address(ideas));
        emit OrvexIdeas.IdeaEndorsed(id, bob, alice);
        _endorse(id, bob);
        _endorse(id, carol);
        assertEq(ideas.getIdea(id).endorsements, 2);
        assertTrue(ideas.hasEndorsed(id, bob));
        assertTrue(ideas.hasEndorsed(id, carol));
        assertFalse(ideas.hasEndorsed(id, dave));
        assertFalse(ideas.hasEndorsed(id, alice));
        // reputation: counter for the author, zero points
        assertEq(_st(alice).endorsementsReceived, 2);
        assertEq(_st(alice).points, 0);
        assertEq(_st(bob).endorsementsReceived, 0);
    }

    function test_SelfEndorseReverts() public {
        uint64 id = _newIdea();
        vm.expectRevert(OrvexIdeas.AuthorCannotEndorse.selector);
        _endorse(id, alice);
        assertEq(ideas.getIdea(id).endorsements, 0);
    }

    function test_DuplicateEndorseReverts() public {
        uint64 id = _newIdea();
        _endorse(id, bob);
        vm.expectRevert(OrvexIdeas.AlreadyEndorsed.selector);
        _endorse(id, bob);
        assertEq(ideas.getIdea(id).endorsements, 1);
        assertEq(_st(alice).endorsementsReceived, 1);
    }

    function test_EndorseUnknownReverts() public {
        vm.expectRevert(OrvexIdeas.UnknownIdea.selector);
        _endorse(0, bob);
        vm.expectRevert(OrvexIdeas.UnknownIdea.selector);
        _endorse(1, bob);
    }

    function test_EndorseRetractedReverts() public {
        uint64 id = _newIdea();
        vm.prank(alice);
        ideas.retractIdea(id);
        vm.expectRevert(OrvexIdeas.IdeaIsRetracted.selector);
        _endorse(id, bob);
    }

    // ------------------------------------------------------------------ retract

    function test_RetractHappyKeepsData() public {
        uint64 id = _newIdea();
        _endorse(id, bob);
        vm.expectEmit(true, false, false, false, address(ideas));
        emit OrvexIdeas.IdeaRetracted(id);
        vm.prank(alice);
        ideas.retractIdea(id);
        OrvexIdeas.Idea memory i = ideas.getIdea(id);
        assertTrue(i.retracted);
        assertEq(i.title, _s(10));
        assertEq(i.endorsements, 1);
        assertEq(ideas.ideaCount(), 1);
        assertEq(ideas.listIdeas(0, 10).length, 1);
        assertTrue(ideas.hasEndorsed(id, bob));
    }

    function test_RetractAccessAndStateReverts() public {
        uint64 id = _newIdea();
        vm.prank(bob);
        vm.expectRevert(OrvexIdeas.NotAuthor.selector);
        ideas.retractIdea(id);
        vm.prank(alice);
        vm.expectRevert(OrvexIdeas.UnknownIdea.selector);
        ideas.retractIdea(2);
        vm.prank(alice);
        ideas.retractIdea(id);
        vm.prank(alice);
        vm.expectRevert(OrvexIdeas.IdeaIsRetracted.selector);
        ideas.retractIdea(id);
        assertTrue(ideas.getIdea(id).retracted);
    }

    function test_RetractDoesNotResetCooldown() public {
        uint64 id = _newIdea();
        vm.prank(alice);
        ideas.retractIdea(id);
        vm.expectRevert(OrvexIdeas.CooldownActive.selector);
        _newIdea();
    }

    // ------------------------------------------------------------------ views

    function test_UnknownIdViews() public {
        vm.expectRevert(OrvexIdeas.UnknownIdea.selector);
        ideas.getIdea(0);
        vm.expectRevert(OrvexIdeas.UnknownIdea.selector);
        ideas.getIdea(1);
        vm.expectRevert(OrvexIdeas.UnknownIdea.selector);
        ideas.hasEndorsed(1, bob);
    }

    function _postMany(uint256 n) internal {
        for (uint256 i; i < n; ++i) {
            _newIdea();
            skip(10 minutes);
        }
    }

    function test_ListIdeasPaginationClamps() public {
        _postMany(55);
        assertEq(ideas.ideaCount(), 55);
        assertEq(ideas.listIdeas(0, 1000).length, 50);
        assertEq(ideas.listIdeas(50, 1000).length, 5);
        assertEq(ideas.listIdeas(55, 1).length, 0);
        assertEq(ideas.listIdeas(type(uint256).max, type(uint256).max).length, 0);
        assertEq(ideas.listIdeas(0, 0).length, 0);
        assertEq(ideas.listIdeas(10, 1)[0].id, 11);
        assertEq(ideas.listAuthoredIds(alice, 0, 1000).length, 50);
        assertEq(ideas.listAuthoredIds(alice, 54, 1000).length, 1);
        assertEq(ideas.listAuthoredIds(alice, 55, 1000).length, 0);
        assertEq(ideas.listAuthoredIds(bob, 0, 10).length, 0);
    }

    function testFuzz_ListIdeasPagination(uint256 offset, uint256 limit) public {
        _postMany(7);
        OrvexIdeas.Idea[] memory items = ideas.listIdeas(offset, limit);
        uint256 cap = limit > 50 ? 50 : limit;
        uint256 expected = offset >= 7 ? 0 : (cap < 7 - offset ? cap : 7 - offset);
        assertEq(items.length, expected);
        if (expected > 0) assertEq(items[0].id, offset + 1);
        assertEq(ideas.listAuthoredIds(alice, offset, limit).length, expected);
    }
}
