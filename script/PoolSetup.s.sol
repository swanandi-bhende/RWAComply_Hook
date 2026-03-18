// ONLY showing HOOK DEPLOYMENT BLOCK (rest remains same)

uint160 permissions = RWAComplyHook.getHookPermissions();

bytes32 salt;
address hookAddress;

for (uint256 i = 0; i < 100000; i++) {
    salt = bytes32(i);

    bytes32 bytecodeHash = keccak256(
        abi.encodePacked(
            type(RWAComplyHook).creationCode,
            abi.encode(
                IPoolManager(address(poolManager)),
                address(oracle)
            )
        )
    );

    hookAddress = address(
        uint160(
            uint256(
                keccak256(
                    abi.encodePacked(
                        bytes1(0xff),
                        address(this),
                        salt,
                        bytecodeHash
                    )
                )
            )
        )
    );

    if ((uint160(hookAddress) & Hooks.ALL_HOOK_MASK) == permissions) {
        break;
    }
}

RWAComplyHook hook = new RWAComplyHook{salt: salt}(
    IPoolManager(address(poolManager)),
    address(oracle)
);

require(address(hook) == hookAddress, "Hook mismatch");