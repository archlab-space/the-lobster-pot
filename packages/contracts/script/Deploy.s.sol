// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {ShellToken} from "../src/ShellToken.sol";
import {GameCore} from "../src/GameCore.sol";
import {Election} from "../src/Election.sol";

contract Deploy is Script {
    function run() external {
        address liquidityWallet = vm.envAddress("LIQUIDITY_WALLET");

        vm.startBroadcast();

        // 1. Deploy ShellToken (1B minted to deployer)
        ShellToken shell = new ShellToken();

        // 2. Deploy GameCore
        GameCore game = new GameCore(address(shell));

        // 3. Deploy Election
        Election election = new Election(address(game));

        // 4. Initialize GameCore with Election address
        game.initialize(address(election));

        // 5. Transfer 75% (750M) SHELL to GameCore for treasury yield backing
        shell.transfer(address(game), 750_000_000 * 1e18);

        // 6. Transfer 10% (100M) SHELL to liquidity wallet
        shell.transfer(liquidityWallet, 100_000_000 * 1e18);

        // 7. Remaining 15% (150M) stays with deployer (team)

        vm.stopBroadcast();
    }
}
