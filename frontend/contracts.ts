// Contract addresses and ABIs
export const HOOK_ADDRESS = "0x851eE973e4Ba7E6d19fF1DcfF9406CC6CE1ef8C0";
export const POOL_MANAGER_ADDRESS = "0x1fA02b2d6A771842690194Cf62D91bdd92BfE28d";
export const ORACLE_ADDRESS = "0xdbC43Ba45381e02825b14322cDdd15eC4B3164E6";
export const TOKEN_A_ADDRESS = "0x21dF544947ba3E8b3c32561399E88B52Dc8b2823";
export const TOKEN_B_ADDRESS = "0x2E2Ed0Cfd3AD2f1d34481277b3204d807Ca2F8c2";
export const EXECUTOR_ADDRESS = "0xDC11f7E700A4c898AE5CAddB1082cFfa76512aDD";

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
