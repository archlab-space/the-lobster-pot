// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IElection {
    function currentTerm() external view returns (uint256);
    function getCurrentKing() external view returns (address);
    function getCurrentKingVoterCount() external view returns (uint256);
    function didVoteForCurrentKing(address voter) external view returns (bool);
}
