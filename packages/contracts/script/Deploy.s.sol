// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ShellToken} from "../src/ShellToken.sol";
import {GameCore} from "../src/GameCore.sol";
import {Election} from "../src/Election.sol";

contract Deploy is Script {
    function run() external {
        address deployer = 0xC1a6A1DAA5A1aC828b6a5Ad1C59bc4bBF7be6723;
        address owner = 0xe15863227482ed51e3ACB382C04deB5CeDb14535;

        vm.startBroadcast();

        // 1. Deploy ShellToken (1B minted to deployer)
        ShellToken shell = new ShellToken();

        // 2. Deploy implementations
        GameCore gameImpl = new GameCore();
        Election electionImpl = new Election();

        // 3. Deploy GameCore proxy (election set to address(0) initially)
        GameCore game = GameCore(address(new ERC1967Proxy(
            address(gameImpl),
            abi.encodeWithSelector(GameCore.initialize.selector, address(shell), address(0), deployer)
        )));

        // 4. Deploy Election proxy
        Election election = Election(address(new ERC1967Proxy(
            address(electionImpl),
            abi.encodeWithSelector(Election.initialize.selector, address(game), deployer)
        )));

        // 5. Set election on GameCore (resolves circular dependency)
        game.setElection(address(election));

        // 6. Transfer 75% (750M) SHELL to GameCore proxy for treasury yield backing
        shell.transfer(address(game), 50_000_000 * 1e18);

        // 7. Transfer 25% (250M) SHELL to owner (team)
        shell.transfer(owner, 950_000_000 * 1e18);

        // 8. Remaining 25% (250M) stays with deployer (team)

        // 9. Transfer ownership of both proxies to owner
        game.transferOwnership(owner);
        election.transferOwnership(owner);
        
        vm.stopBroadcast();
    }
}
