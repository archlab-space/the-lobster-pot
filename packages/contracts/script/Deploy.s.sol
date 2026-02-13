// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ShellToken} from "../src/ShellToken.sol";
import {GameCore} from "../src/GameCore.sol";
import {Election} from "../src/Election.sol";

contract Deploy is Script {
    function run() external {
        address liquidityWallet = vm.envAddress("LIQUIDITY_WALLET");

        vm.startBroadcast();

        // 1. Deploy ShellToken (1B minted to deployer)
        ShellToken shell = new ShellToken();

        // 2. Deploy implementations
        GameCore gameImpl = new GameCore();
        Election electionImpl = new Election();

        // 3. Deploy GameCore proxy (election set to address(0) initially)
        GameCore game = GameCore(address(new ERC1967Proxy(
            address(gameImpl),
            abi.encodeWithSelector(GameCore.initialize.selector, address(shell), address(0), msg.sender)
        )));

        // 4. Deploy Election proxy
        Election election = Election(address(new ERC1967Proxy(
            address(electionImpl),
            abi.encodeWithSelector(Election.initialize.selector, address(game), msg.sender)
        )));

        // 5. Set election on GameCore (resolves circular dependency)
        game.setElection(address(election));

        // 6. Transfer 75% (750M) SHELL to GameCore proxy for treasury yield backing
        shell.transfer(address(game), 750_000_000 * 1e18);

        // 7. Transfer 10% (100M) SHELL to liquidity wallet
        shell.transfer(liquidityWallet, 100_000_000 * 1e18);

        // 8. Remaining 15% (150M) stays with deployer (team)

        vm.stopBroadcast();
    }
}
