// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {OrvexIdentity} from "../OrvexIdentity.sol";
import {OrvexProof} from "../OrvexProof.sol";
import {OrvexChallenges} from "../OrvexChallenges.sol";
import {OrvexLaunchpad} from "../OrvexLaunchpad.sol";
import {OrvexIdeas} from "../OrvexIdeas.sol";

/// @notice Deploy and permanently wire ORVEX on Arc Mainnet or Arc Testnet using the configured broadcaster.
/// @dev Supply the broadcaster through Foundry's external signer configuration; this script contains no key.
/// Ownership remains with the deployer. After finalization the owner cannot alter either recorder allowlist.
/// No transferOwnership call is made, and no module has an administrative override over user content.
contract DeployOrvex is Script {
    /// @notice This script supports only Arc Mainnet (5042) and Arc Testnet (5042002).
    error UnsupportedChain();

    /// @notice Deploy all five modules, configure their recorder permissions, freeze both allowlists, and log addresses.
    function run() external {
        if (block.chainid != 5042 && block.chainid != 5042002) revert UnsupportedChain();
        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();
        OrvexIdentity identity = new OrvexIdentity(deployer);
        OrvexProof proof = new OrvexProof(deployer, identity);
        OrvexChallenges challenges = new OrvexChallenges(identity, proof);
        OrvexLaunchpad launchpad = new OrvexLaunchpad(identity, proof);
        OrvexIdeas ideas = new OrvexIdeas(identity);

        identity.setRecorder(address(challenges), true);
        identity.setRecorder(address(launchpad), true);
        identity.setRecorder(address(ideas), true);
        proof.setRecorder(address(challenges), true);
        proof.setRecorder(address(launchpad), true);
        identity.finalizeRecorders();
        proof.finalizeRecorders();
        vm.stopBroadcast();

        console2.log("OrvexIdentity", address(identity));
        console2.log("OrvexProof", address(proof));
        console2.log("OrvexChallenges", address(challenges));
        console2.log("OrvexLaunchpad", address(launchpad));
        console2.log("OrvexIdeas", address(ideas));
    }
}
