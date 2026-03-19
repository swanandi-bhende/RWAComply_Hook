// Contract addresses and ABIs
export const HOOK_ADDRESS = "0xc76AB729c5e92964F4ea91870cE751A64434f8c0";
export const POOL_MANAGER_ADDRESS = "0x82e01223d51Eb87e16A03E24687EDF0F294da6f1";
export const ORACLE_ADDRESS = "0x2bdCC0de6bE1f7D2ee689a0342D76F52E8EFABa3";
export const TOKEN_A_ADDRESS = "0xc351628EB244ec633d5f21fBD6621e1a683B1181";
export const TOKEN_B_ADDRESS = "0xFD471836031dc5108809D173A067e8486B9047A3";
export const EXECUTOR_ADDRESS = "0x1429859428C0aBc9C2C47C8Ee9FBaf82cFA0F20f";

export const ANVIL_CHAIN_ID = 31337;

// MockERC20 ABI
export const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
];

// RWAComplyHook ABI
export const HOOK_ABI = [
  "function getBaseFeeForTier(uint8 tier) external view returns (uint24)",
  "function isVerifiedTier1(address user) external view returns (bool)",
  "function isVerifiedTier2(address user) external view returns (bool)",
  "function retailSwapCap() external view returns (uint256)",
  "function volatilityThreshold() external view returns (uint256)",
  "function oracle() external view returns (address)",
  "function owner() external view returns (address)",
  "function setVolatilityThreshold(uint256 _threshold) external",
  "function setRetailSwapCap(uint256 _cap) external",
  "function setOracle(address _oracle) external",
  "function pausePool(bytes32 poolId) external",
  "function unpausePool(bytes32 poolId) external",
];

// MockRWAOracle ABI
export const ORACLE_ABI = [
  "function getVolatility() external view returns (uint256)",
  "function owner() external view returns (address)",
  "function setVolatility(uint256 _vol) external",
];

// Tier information
export const TIER_NAMES = {
  0: "Unverified",
  1: "Tier 1 (KYC)",
  2: "Tier 2 (Enhanced)",
};

export const TIER_COLORS = {
  0: "text-gray-500 bg-gray-100",
  1: "text-blue-600 bg-blue-100",
  2: "text-purple-600 bg-purple-100",
};
