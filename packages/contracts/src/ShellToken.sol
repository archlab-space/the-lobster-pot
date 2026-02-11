// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract ShellToken is ERC20, ERC20Burnable {
    constructor() ERC20("Shell Token", "SHELL") {
        _mint(msg.sender, 1_000_000_000 * 1e18);
    }
}
