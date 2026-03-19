// Contract addresses and ABIs
export const HOOK_ADDRESS = "0xf4C4Ac3Ec1d5FBa46879Db82764d8fA1eC14B8c0";
export const POOL_MANAGER_ADDRESS = "0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf";
export const ORACLE_ADDRESS = "0x0E801D84Fa97b50751Dbf25036d067dCf18858bF";
export const TOKEN_A_ADDRESS = "0x5eb3Bc0a489C5A8288765d2336659EbCA68FCd00";
export const TOKEN_B_ADDRESS = "0x36C02dA8a0983159322a80FFE9F24b1acfF8B570";
export const EXECUTOR_ADDRESS = "0x4c5859f0F772848b2D91F1D83E2Fe57935348029";

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
