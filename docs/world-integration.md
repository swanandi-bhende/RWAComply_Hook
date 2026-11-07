# World ID integration note

## Time to the first successful verification

A live World ID proof has not been completed. No clock time from opening the widget to a successful `developer.world.org` verify response has been measured. The server path is implemented and covered by fixture tests. `npm run verify:world-signer`, run from `frontend/`, checks that `WORLD_PRIVATE_KEY` matches `WORLD_RP_SIGNER_ADDRESS` and does not print either value. That check is configuration, not a proof verification.

## Failure path that was demonstrated

A cancelled, failed, or timed-out IDKit widget does not authorize a wallet and does not call `registerWallet`. That is `a cancelled or failed World ID widget does not authorize or register the wallet` in `frontend/lib/world/enrollmentAction.test.mts`.

A proof World rejects does not create an enrollment. The database write is not committed. That is `portal failures do not create an enrollment` in `frontend/lib/world/enroll.test.mts`. The same file rejects the wrong action, environment, credential, nullifier, and session binding.

These are local tests against the server code. They are not a recording of the World widget on a device.

IDKit 4.6 can request `proof_of_human`, `selfie`, `passport`, or `mnc`. Proof of human is the Orb credential. Passport and national-ID credentials need an NFC document. Selfie Check does not need an Orb, but it is not enabled for this staging application. No other installed credential is available without one of those. `RWA_DEMO_IDENTITY` is a separate localhost or hackathon demo identity. It is not sent to World and it is not labelled as proof of human.

IDKit 4.6 keeps one bridge, `https://bridge.worldcoin.org`. The connector host comes from the configured environment. `sandbox` uses `https://sandbox.world.org/verify` and is the TestFlight and Play app. `staging` uses `https://staging.world.org/verify` and is the browser simulator. This deployment sets `WORLD_ID_ENVIRONMENT=sandbox`, and both the first request and `IDKit.proveSession` pass that value through. The page encodes IDKit’s connector URI as the QR and the Open World App link. Polling stays on the same request. The backend posts the proof to `https://developer.world.org/api/v4/verify/{rp_id}` and accepts it only when the proof environment matches the server. “Proof of human verified” is shown only after `/api/world/enroll` accepts the proof and `/api/world/identity` reports the saved session.

## Documentation gap

World's first pages make `IDKit.createSession()` look like the way to keep a person across wallets. This app does not call it. The second wallet uses `IDKit.proveSession` with no action. The result's `session_nullifier` only ties that interaction to the same session. It is not the uniqueness nullifier from the `signup` proof, and it is not the allocation id. The allocation id is a random `bytes32` created by this backend after World accepts the first proof.

## AI-use attribution

ETHGlobal allows AI tools if the submission says where they were used. Cursor's coding agent assisted the work on `v2` after commit `1629f37` (2026-03-20). That assistance covers `src/AllocationLedger.sol`, the budget checks in `src/RWAComplyHook.sol`, the exact-input path in `src/PoolExecutor.sol`, the World ID routes under `frontend/app/api/world/`, the investor pages, the Arkiv client under `frontend/lib/arkiv/`, and the submission notes. The repository owner set the roadmap, put the World, allocation, and Arkiv secrets in the repository-root `.env`, and approved the Sepolia broadcast. The hook, oracle, demo UI, and local deploy that existed at `1629f37` were already in the repository. No separate spec-kit was used. The planning artifacts are `docs/PRD v1.txt` and this repository's own docs.
