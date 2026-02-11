// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IElection {
    function getCurrentKingVoterCount() external view returns (uint256);
    function didVoteForCurrentKing(address voter) external view returns (bool);
}
