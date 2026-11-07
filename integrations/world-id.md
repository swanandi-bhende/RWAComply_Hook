# World ID

World ID is the proof of human for this session. It is not KYC, AML, accreditation, residency, nationality, or legal eligibility. It does not set the issuer tier and it does not register the wallet by itself.

A live proof has not been completed. The server path and its failure tests exist. There is no measured time from opening the widget to a successful World response. The guided Anvil demo does not count as this proof. The note is [docs/world-integration.md](../docs/world-integration.md).

## Flow

1. [`frontend/app/api/world/rp-context/route.ts`](../frontend/app/api/world/rp-context/route.ts) returns a short-lived context signed with `WORLD_PRIVATE_KEY`.
2. The first wallet uses IDKit with action `signup`, `session_id: "create"`, and `allow_legacy_proofs: false`.
3. [`frontend/app/api/world/enroll/route.ts`](../frontend/app/api/world/enroll/route.ts) posts the IDKit result to `https://developer.world.org/api/v4/verify/{rp_id}`.
4. After World accepts it, the server creates a random `bytes32` allocation id and stores the session with AES-256-GCM. The raw session id and the raw nullifier are not stored. A duplicate proof returns HTTP 409.
5. A later wallet calls `IDKit.proveSession`. The app does not call `IDKit.createSession`. The session nullifier only ties that interaction to the same session. It is not the allocation id.
6. [`frontend/app/api/world/continue/route.ts`](../frontend/app/api/world/continue/route.ts) verifies the proof and returns a one-time grant. The response does not include the allocation id.
7. The wallet signs an EIP-712 `WalletLink`. [`frontend/app/api/world/wallet-authorization/route.ts`](../frontend/app/api/world/wallet-authorization/route.ts) checks it and returns a registration authorization for the existing allocation id.
8. The wallet calls `AllocationLedger.registerWallet`. The page shows the wallet as linked only after the chain receipt matches.

The browser may keep the session id in `sessionStorage`. The backend copy is the one that can issue a grant. Possession of the session id alone is not identity and is not wallet ownership.

## Failures

A cancelled, failed, or timed-out widget does not authorize a wallet and does not call `registerWallet`. A proof World rejects does not create an enrollment. A bad wallet signature, an expired authorization, a reused nonce, and a wallet already bound to another allocation id are rejected. Tests live under `frontend/lib/world/`.

`npm run verify:world-signer`, from `frontend/`, checks that `WORLD_PRIVATE_KEY` matches `WORLD_RP_SIGNER_ADDRESS` and prints neither value.

The World signer and the allocation signer are different keys. Registration signatures are covered in [architecture.md](../architecture.md).
