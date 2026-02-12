// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGameCore {
    function getEffectiveBalance(address player) external view returns (uint256);
    function isInsolvent(address player) external view returns (bool);
    function isActivePlayer(address player) external view returns (bool);
    function getJoinedBlock(address player) external view returns (uint64);
    function setKing(address newKing) external;
    function deductKrill(address player, uint256 amount) external;
    function creditKrill(address player, uint256 amount) external;
    function king() external view returns (address);
    function activePlayers() external view returns (uint256);
    function treasury() external view returns (uint256);
    function creditTreasury(uint256 amount) external;
    function settleDelinquent(address playerAddr) external;
    function isDelinquent(address addr) external view returns (bool);
    function settleTax() external;
    function pause() external;
    function unpause() external;
    function emergencyWithdrawShell() external;
}
