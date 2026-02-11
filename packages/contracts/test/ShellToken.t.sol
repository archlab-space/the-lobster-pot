// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ShellToken} from "../src/ShellToken.sol";

contract ShellTokenTest is Test {
    ShellToken public token;
    address public deployer = address(this);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    function setUp() public {
        token = new ShellToken();
    }

    function test_TotalSupply() public view {
        assertEq(token.totalSupply(), 1_000_000_000 * 1e18);
    }

    function test_NameAndSymbol() public view {
        assertEq(token.name(), "Shell Token");
        assertEq(token.symbol(), "SHELL");
    }

    function test_DeployerBalance() public view {
        assertEq(token.balanceOf(deployer), 1_000_000_000 * 1e18);
    }

    function test_Transfer() public {
        token.transfer(alice, 1000 * 1e18);
        assertEq(token.balanceOf(alice), 1000 * 1e18);
        assertEq(token.balanceOf(deployer), 1_000_000_000 * 1e18 - 1000 * 1e18);
    }

    function test_Burn() public {
        uint256 burnAmount = 500 * 1e18;
        token.burn(burnAmount);
        assertEq(token.totalSupply(), 1_000_000_000 * 1e18 - burnAmount);
        assertEq(token.balanceOf(deployer), 1_000_000_000 * 1e18 - burnAmount);
    }

    function test_BurnFrom() public {
        token.transfer(alice, 1000 * 1e18);
        vm.prank(alice);
        token.approve(deployer, 500 * 1e18);
        token.burnFrom(alice, 500 * 1e18);
        assertEq(token.balanceOf(alice), 500 * 1e18);
    }

    function test_Decimals() public view {
        assertEq(token.decimals(), 18);
    }
}
