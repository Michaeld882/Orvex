// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {OrvexTestBase} from "./Orvex.Base.t.sol";
import {OrvexIdentity} from "../OrvexIdentity.sol";
import {OrvexProof} from "../OrvexProof.sol";
import {OrvexChallenges} from "../OrvexChallenges.sol";
import {OrvexLaunchpad} from "../OrvexLaunchpad.sol";
import {OrvexIdeas} from "../OrvexIdeas.sol";
import {ActivityKind, IOrvexProof} from "../interfaces/IOrvex.sol";
import {DeployOrvex} from "../script/DeployOrvex.s.sol";

/// @dev The suite never accepts value: no receive/fallback, no payable function or constructor.
contract OrvexNoPayableTest is OrvexTestBase {
    function _all() internal view returns (address[5] memory a) {
        a = [address(identity), address(proof), address(challenges), address(launchpad), address(ideas)];
    }

    function setUp() public override {
        super.setUp();
        vm.deal(address(this), 100 ether);
        vm.deal(alice, 100 ether);
    }

    function test_PlainEthTransferReverts() public {
        address[5] memory a = _all();
        for (uint256 i; i < 5; ++i) {
            (bool ok,) = a[i].call{value: 1 wei}("");
            assertFalse(ok, "receive() must not exist");
            assertEq(a[i].balance, 0);
        }
    }

    function test_UnknownSelectorWithOrWithoutValueReverts() public {
        address[5] memory a = _all();
        for (uint256 i; i < 5; ++i) {
            (bool ok,) = a[i].call{value: 1 wei}(hex"deadbeef");
            assertFalse(ok, "fallback() must not exist (with value)");
            (ok,) = a[i].call(hex"deadbeef");
            assertFalse(ok, "fallback() must not exist (no value)");
            assertEq(a[i].balance, 0);
        }
    }

    function test_StateChangingFunctionsRejectValue() public {
        bytes[] memory calls = new bytes[](14);
        calls[0] = abi.encodeCall(OrvexIdentity.setProfile, ("Alice", "", "", ""));
        calls[1] = abi.encodeCall(OrvexIdentity.setRecorder, (bob, true));
        calls[2] = abi.encodeCall(OrvexIdentity.finalizeRecorders, ());
        calls[3] = abi.encodeCall(OrvexIdentity.record, (bob, ActivityKind.IdeaPosted, ""));
        calls[4] = abi.encodeCall(OrvexProof.claimAchievement, (0));
        calls[5] = abi.encodeCall(OrvexProof.record, (bob, alice, IOrvexProof.Source.Challenge, 1, "T", "https://x.io"));
        calls[6] = abi.encodeCall(OrvexChallenges.createChallenge, ("Title", "Description 1", "skill", "", uint40(T0 + 1 days), 5));
        calls[7] = abi.encodeCall(OrvexChallenges.joinChallenge, (1));
        calls[8] = abi.encodeCall(OrvexChallenges.submitWork, (1, "https://x.io", ""));
        calls[9] = abi.encodeCall(OrvexChallenges.reviewSubmission, (1, bob, true));
        calls[10] = abi.encodeCall(OrvexLaunchpad.proposeProject, ("Name", "Tagline", "Description 1", "cat", ""));
        calls[11] = abi.encodeCall(OrvexLaunchpad.submitContribution, (1, "Title", "https://x.io"));
        calls[12] = abi.encodeCall(OrvexIdeas.postIdea, ("Title", "Body of idea", "tag"));
        calls[13] = abi.encodeCall(OrvexIdeas.endorse, (1));
        address[14] memory targets = [
            address(identity), address(identity), address(identity), address(identity),
            address(proof), address(proof),
            address(challenges), address(challenges), address(challenges), address(challenges),
            address(launchpad), address(launchpad),
            address(ideas), address(ideas)
        ];
        for (uint256 i; i < calls.length; ++i) {
            vm.prank(owner);
            (bool ok,) = targets[i].call{value: 1 wei}(calls[i]);
            assertFalse(ok, "state-changing function accepted value");
            assertEq(targets[i].balance, 0);
        }
    }

    function test_ViewsAndRemainingMutatorsRejectValue() public {
        bytes[] memory calls = new bytes[](8);
        calls[0] = abi.encodeCall(OrvexChallenges.closeChallenge, (1));
        calls[1] = abi.encodeCall(OrvexChallenges.cancelChallenge, (1));
        calls[2] = abi.encodeCall(OrvexChallenges.challengeCount, ());
        calls[3] = abi.encodeCall(OrvexLaunchpad.setStage, (1, OrvexLaunchpad.Stage.Live));
        calls[4] = abi.encodeCall(OrvexLaunchpad.postUpdate, (1, "hello"));
        calls[5] = abi.encodeCall(OrvexLaunchpad.reviewContribution, (1, true));
        calls[6] = abi.encodeCall(OrvexIdeas.retractIdea, (1));
        calls[7] = abi.encodeCall(OrvexIdeas.ideaCount, ());
        address[8] memory targets = [
            address(challenges), address(challenges), address(challenges),
            address(launchpad), address(launchpad), address(launchpad),
            address(ideas), address(ideas)
        ];
        for (uint256 i; i < calls.length; ++i) {
            (bool ok,) = targets[i].call{value: 1 wei}(calls[i]);
            assertFalse(ok);
            assertEq(targets[i].balance, 0);
        }
    }

    function test_ConstructorsAreNotPayable() public {
        bytes memory c1 = abi.encodePacked(type(OrvexIdentity).creationCode, abi.encode(owner));
        bytes memory c2 = abi.encodePacked(type(OrvexIdeas).creationCode, abi.encode(address(identity)));
        bytes memory c3 = abi.encodePacked(type(OrvexProof).creationCode, abi.encode(owner, address(identity)));
        bytes memory c4 = abi.encodePacked(type(OrvexChallenges).creationCode, abi.encode(address(identity), address(proof)));
        bytes memory c5 = abi.encodePacked(type(OrvexLaunchpad).creationCode, abi.encode(address(identity), address(proof)));
        bytes[5] memory codes = [c1, c2, c3, c4, c5];
        for (uint256 i; i < 5; ++i) {
            bytes memory code = codes[i];
            address deployed;
            assembly {
                deployed := create(1, add(code, 0x20), mload(code))
            }
            assertEq(deployed, address(0), "payable constructor");
        }
    }
}

/// @dev Exercises the real deploy script (no key involved) to confirm it wires the same way as the shared fixture.
contract OrvexDeployScriptTest is OrvexTestBase {
    function test_ScriptRefusesUnsupportedChain() public {
        DeployOrvex s = new DeployOrvex();
        vm.chainId(1);
        vm.expectRevert(DeployOrvex.UnsupportedChain.selector);
        s.run();
    }

    function test_ScriptRunsOnArcMainnetAndTestnet() public {
        DeployOrvex s = new DeployOrvex();
        vm.chainId(5042);
        s.run();
        vm.chainId(5042002);
        s.run();
    }
}
