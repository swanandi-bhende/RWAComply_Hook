// Contract addresses - loaded from environment
// These are fallbacks; deployment config loader is the source of truth
export const HOOK_ADDRESS = process.env.NEXT_PUBLIC_HOOK_ADDRESS || "";
export const POOL_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_POOL_MANAGER || "";
export const ORACLE_ADDRESS = process.env.NEXT_PUBLIC_ORACLE_ADDRESS || "";
export const TOKEN_A_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_A_ADDRESS || "";
export const TOKEN_B_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_B_ADDRESS || "";
export const EXECUTOR_ADDRESS = process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS || "";

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
