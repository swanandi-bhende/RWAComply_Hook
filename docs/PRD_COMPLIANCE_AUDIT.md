# PRD compliance audit

## A. Audit scope and methodology

- PRD file: `docs/PRD v1.txt`, read from line 1 through line 2670, including the closing line.
- Date: 6 November 2026.
- Branch: `v2`.
- This audit followed Steps 6.5–6.10. It did not start Step 6.11 or the PRD's later phase plan as new implementation work.

Coverage:

- Every numbered section from 1 through 32 was read.
- Illustrative sentences that repeat a rule already in this matrix are not given a second row. The matrix has 160 distinct requirements.
- Section 4.4 non-goals, the section 28 schedule, the section 31 proposed tree, and the unused trade-authorization replay case are marked not applicable or superseded, with the reason in the row.

Sources inspected:

- `src/AllocationLedger.sol`, `src/RWAComplyHook.sol`, `src/PoolExecutor.sol`.
- `frontend/app/api/world/`, `frontend/app/api/offerings/route.ts`, `frontend/app/api/product/status`.
- `frontend/components/product/InvestorExperience.tsx`, `Landing.tsx`, `HowItWorks.tsx`, `SwapDemo.tsx`, `AdminObservatory.tsx`.
- `script/demo_allocation_journey.sh`, `script/DeploySepolia.s.sol`, `README.md`, `FEEDBACK.md`, `arkiv/*.md`, `docs/development.md`, `docs/world-integration.md`, `docs/demo-script.md`.
- Tests run in this session: `forge test` (114 passed) and `npm run test:world` (83 passed).

Live reads in this session, with no writes:

- Ethereum Sepolia, chain id `11155111`. Hook `0xD092CbB8De7cCa60807Ca73213f12920Afd308c0` has 8904 bytes of code. Allocation ledger `0xc74c64fee3b4C2D1E2ed37F218f0179026A9ceeA` has 6428 bytes. Group `0xa6d68dbbe026d4e383d3af4257793a771d58cc2c2388bde9d3273a210e581677`, period 1, cap `1000000000`, USDC `0x2BC48314C0B0B51E67E607FbC160304E9fD755Fe`.
- Arkiv Rabdi entity `0x6feefc2d7a889123485ccb454bba924db7057a8d18d5cb0b3e6a49c66a2a5578`, writer `0xbfBf7Ca4f33993fA8b918d38286dad927231FB72`, one match for the documented query.

Signer correction, 6 November 2026: an independent Sepolia read found `backendSigner()` `0x28FB61Dc27a37091f53C0c37b5026AdBbF5E1F46`. The address derived from `ALLOCATION_AUTH_SIGNING_KEY` matches `ALLOCATION_AUTH_SIGNER_ADDRESS` and that onchain value. It does not match the deployer `0x36Dc780DA078Ab4b8C5923bEd34eF4546DCb8ce6` or the World ID signer `0x77543b2a9d2555F778edC1A5a2642c4a969850c1`. The ledger owner is the deployer. No signer rotation was sent. Rows written before this read that called the deployer the backend signer are superseded by this correction.

Known limits of this audit:

- No World ID widget was completed, so enroll, continue, and Sepolia `registerWallet` are not live-verified.
- No Sepolia investor purchase was sent.
- Viewports were not rechecked in this session. Steps 6.5–6.10 did not change UI code.
- `docs/continuity/README.md` was not treated as current. `docs/sepolia-deployment.md` and the live reads were.

## B. Executive summary

160 distinct requirements.

| Status | Count |
|---|---|
| IMPLEMENTED AND VERIFIED | 76 |
| IMPLEMENTED, NOT FULLY VERIFIED | 21 |
| PARTIALLY IMPLEMENTED | 50 |
| NOT IMPLEMENTED | 7 |
| CONTRADICTED OR INCONSISTENT | 2 |
| NOT APPLICABLE / SUPERSEDED | 4 |
| Total | 160 |

76 + 21 + 50 + 7 + 2 + 4 = 160.

The shared-budget hook path is real: local tests, the Anvil journey, and the deployed Sepolia policy agree. The product is not PRD-complete. A person has not finished World ID, no investor is registered on Sepolia, two pools do not share a group, and the issuer workflow in section 8.1 is not a product. The PRD's separate identity registry, policy registry, and per-swap signed trade intent were not built. The trusted executor is the control that was built instead.

## C. Requirement-by-requirement matrix

160 distinct requirements. Each row is one requirement. Restated sentences in the PRD that repeat a row below are not counted again.

| PRD reference | Requirement | Status | Implementation evidence | Gap or explanation |
|---|---|---|---|---|
| 1.1 L26 | RWAComply lets one verified human share one purchase budget across wallets, enforced inside a Uniswap v4 hook. | PARTIALLY IMPLEMENTED | AllocationLedger plus RWAComplyHook.beforeSwap and PoolExecutor.swapExactInput. Forge AllocationJourney tests. | A live World ID proof has not been completed, and the issuer cannot create an offering from a product workflow. |
| 1.2 L32 | Separate wallets can otherwise each buy a full retail cap. The example is 700, 500, and 400. | IMPLEMENTED AND VERIFIED | testSharedIdentityPurchasesRecordSettledUsdc and script/demo_allocation_journey.sh on Anvil. | The 400 example is narrative. The enforced case is 700 then a rejected 500 then 200. |
| 1.3 L43 | The V2 solution is World ID continuity, one allocation id, and hook enforcement of gross USDC spend. | PARTIALLY IMPLEMENTED | frontend/app/api/world and src/AllocationLedger.sol. | World continuity is implemented and fixture-tested. It has not been completed on a device. |
| 1.4 L60 | The product promise is a shared remaining budget the investor can see before buying. | IMPLEMENTED, NOT FULLY VERIFIED | InvestorExperience reads remaining from the Sepolia ledger when a wallet is connected. | No Sepolia wallet has been registered, so the live page has not shown a real remaining balance for an enrolled investor. |
| 1.5 L62 | RWAComply is not a KYC provider, a full compliance platform, a token issuer, an identity wallet, a frontend-only restriction, or a detector of every wallet a person owns. | IMPLEMENTED AND VERIFIED | README Limits. The hook only sees wallets registered to an allocation id. No KYC vendor is integrated. | None. |
| 1.6 L72 | The target journey is issuer policy, Alice enrolls Wallet A, buys 700, links Wallet B, a 500 buy reverts, a 200 buy succeeds, and Bob has a separate budget. | PARTIALLY IMPLEMENTED | Anvil script demo_allocation_journey.sh and docs/demo-script.md. Forge tests cover the shared counter and the separate person. | Issuer setup is a deploy script. Alice's World ID steps have not been done live. The purchase numbers were demonstrated on Anvil, not Sepolia. |
| 2.1 L91 | V1 behavior remains: tiers, retail cap, institutional allowlist, oracle, dynamic fees, admin, pause, PoolExecutor, mocks, Foundry tests, and a local demo. | IMPLEMENTED AND VERIFIED | forge test, 114 passed, including hook tier, fee, pause, and executor suites. /demo is still served. | Institutional access is the existing tier allowlist, not a separate allocation product. |
| 2.2 L121 | V2 adds human-scoped allocation, multi-wallet linking, shared spend, and public offering metadata. | PARTIALLY IMPLEMENTED | Ledger, World routes, Arkiv offering entity. | See the gaps under identity, issuer workflow, and multi-pool sharing. |
| 3.1 L179 | The primary problem is a per-wallet cap that the same person can evade with another wallet. | IMPLEMENTED AND VERIFIED | spentByAllocation is keyed by allocation id, group, and period in AllocationLedger. | Only registered wallets share that counter. |
| 3.2 L183 | Issuers need a maximum per investor, a maximum of one offering, retail versus institutional limits, a period, and issuer-defined eligibility. | PARTIALLY IMPLEMENTED | One group, period 1, cap 1000000000 on Sepolia. Hook tiers still exist. | No separate institutional allocation cap. Eligibility is owner-set tier plus registration, not an issuer product. |
| 3.4 L211 | The product does not stop a second World ID, purchases outside the supported route, later token transfers, other chains, KYC, accreditation, residency, fraudulent issuers, bad asset data, or every jurisdiction. | IMPLEMENTED AND VERIFIED | README Limits and docs/world-integration.md. Hook checks only PoolExecutor.swapExactInput. | This is an accepted boundary, not a missing control. |
| 4.2.1 L230 | A verified human can link more than one wallet to one allocation identity. | IMPLEMENTED, NOT FULLY VERIFIED | continue, wallet-challenge, and wallet-authorization routes. Tests reject reuse, expiry, and a conflicting allocation. | No live second-wallet World ID proof has been completed. |
| 4.2.2 L231 | Those wallets share one purchase budget. | IMPLEMENTED AND VERIFIED | AllocationJourney shared-identity test and the Anvil journey. | Sepolia has no investor spend to show the same fact on the public market. |
| 4.2.3 L232 | The limit is applied inside Uniswap v4 execution. | IMPLEMENTED AND VERIFIED | RWAComplyHook.beforeSwap and afterSwap. Untrusted router and direct callback tests pass. | The check runs only when the trusted executor calls PoolManager. |
| 4.2.4 L233 | An issuer can configure and manage allocation policies. | PARTIALLY IMPLEMENTED | AllocationLedger.setPolicy is owner-only. DeploySepolia sets the demo policy. | There is no issuer "Create Offering" transaction flow. |
| 4.2.5 L234 | Spending and remaining budget are visible. | IMPLEMENTED, NOT FULLY VERIFIED | GET /api/product/status and the investor page read policy and remaining from Ethereum. | Remaining is blank until a registered wallet is connected. No Sepolia investor is registered. |
| 4.2.6 L235 | Multiple pools can share one allocation group. | NOT IMPLEMENTED | The ledger key is group and period, so the data model allows it. | Only one pool is deployed. No test buys through two pools and one group. |
| 4.2.7 L236 | Arkiv publishes and retrieves public offering information. | IMPLEMENTED AND VERIFIED | Entity 0x6feefc2d7a889123485ccb454bba924db7057a8d18d5cb0b3e6a49c66a2a5578 read back on Rabdi during this audit. GET /api/offerings. | The stored fields are the roadmap schema, which is narrower than the PRD example. |
| 4.2.8 L237 | Useful V1 behavior is preserved. | IMPLEMENTED AND VERIFIED | The V1 hook tests passed in this forge test run. | None. |
| 4.3.1 L239 | Institutional allowlisting stays a separate access path. | PARTIALLY IMPLEMENTED | Hook setTier and AdminObservatory on the home page. | The allocation ledger still caps every registered wallet. An issuer cannot mark an institutional wallet unrestricted. |
| 4.3.2 L240 | Volatility-aware dynamic fees stay if they are stable. | IMPLEMENTED AND VERIFIED | Dynamic fee tests in the hook suite passed. | The Sepolia pool uses the dynamic-fee flag. Fee behavior was not re-traded on Sepolia in this session. |
| 4.3.3 L241 | A basic issuer dashboard exists. | PARTIALLY IMPLEMENTED | AdminObservatory can call setTier, setRetailCap, setOracle, and pausePool. | It does not create an offering, set an allocation policy, or show aggregate purchases. |
| 4.3.4 L242 | The identity and enforcement model is explained. | IMPLEMENTED AND VERIFIED | README, /how, and docs/development.md. | None. |
| 4.3.5 L243 | Other issuers can integrate the system later. | NOT IMPLEMENTED | Docs describe the contracts. | There is no second issuer, no published integration package, and policy admin is the single owner. |
| 4.4 L244 | The first release excludes a security-token platform, KYC/AML, cross-chain identity, a universal passport, transfer compliance, identity recovery, a legal engine, AI investment advice, multi-currency allocation, and full institutional onboarding. | NOT APPLICABLE / SUPERSEDED | docs/PRD v1.txt section 4.4 lists these as non-goals. | Not in scope. They were not built, which matches the PRD. |
| 5.1 L260 | A retail investor can connect, verify, understand the request, link another wallet, and see the limit, spend, remainder, and a rejection reason. | PARTIALLY IMPLEMENTED | InvestorExperience and SwapDemo error copy. | Live verification and a Sepolia purchase have not been done. Purchase history from other sessions is not listed. |
| 5.2 L278 | An issuer can create an offering, set the cap, period, quote currency, and shared pools, pause, update policy, publish to Arkiv, and see aggregate activity. | PARTIALLY IMPLEMENTED | Owner setPolicy, hook pausePool, and the Arkiv publish script. | No issuer UI for those steps. No aggregate purchase view. One pool only. |
| 5.3 L297 | An administrator can manage configuration, issuers, verification signers, pause, events, verification failures, and backend configuration. | PARTIALLY IMPLEMENTED | Contract owner, backendSigner, and the root .env. Hook events exist. | No admin product for issuers, verification-failure monitoring, or log review. |
| 5.4 L308 | A developer can understand the hook, register a pool to a group, see supported routes, read policy and spend, and reuse the check. | PARTIALLY IMPLEMENTED | README, FEEDBACK.md, and the contract interfaces. | Pool-to-group setup is inside the deploy script, not a documented integrator transaction sequence beyond that script. |
| 7.1 L375 | World ID is the proof-of-human credential. | IMPLEMENTED, NOT FULLY VERIFIED | IDKit request on enroll, verified server-side at developer.world.org. | No live proof has been accepted. |
| 7.2 L379 | A session is created, stored, continued, verified, and then used to attach a new wallet. | IMPLEMENTED, NOT FULLY VERIFIED | enroll, continue, and the encrypted session row. IDKit.proveSession is the continuation call. | createSession is intentionally unused. Live continuation has not been done. |
| 7.3 L392 | Allocation identities are issuer-scoped, so the same person can have different ids for different issuers. | CONTRADICTED OR INCONSISTENT | The backend stores one allocation id per enrollment, not per issuer. | There is one demo issuer. A second issuer would not get a separate id from the current schema. |
| 7.4 L404 | Wallet registration binds a wallet to an allocation id onchain. | IMPLEMENTED, NOT FULLY VERIFIED | AllocationLedger.registerWallet and the receipt check in the investor page. | No Sepolia registration has been sent. |
| 7.5 L409 | A policy has an issuer, offering name, maximum, quote token, period, and group. | PARTIALLY IMPLEMENTED | Ledger Policy stores cap, periodId, and USDC. The group id is the mapping key. | Issuer, offering name, and a human period label live in Arkiv or not at all. The ledger does not store them. |
| 7.6 L418 | An allocation group is the shared spending scope across pools. | PARTIALLY IMPLEMENTED | spentByAllocation is keyed by allocation, group, and period. | One pool is deployed, so sharing across pools is unproven. |
| 7.7 L430 | Spend is gross USDC. Purchases count, sales do not, failed transactions do not, and unsupported routes do not. | IMPLEMENTED AND VERIFIED | AllocationJourney tests for sell, insufficient balance, ledger rejection, exact output, and the wrong hook. | None for the single-pool case. |
| 7.8 L439 | Remaining allocation is the cap minus cumulative spend, and it is not stored as a second counter that can drift. | IMPLEMENTED AND VERIFIED | AllocationLedger.remaining computes cap minus spend. The investor page reads that function. | Unregistered wallets revert on remaining. The UI leaves the value empty. |
| 8.1 L447 | The issuer creates an offering from a dashboard, confirms a policy transaction, publishes to Arkiv, and sees the directory. | PARTIALLY IMPLEMENTED | publish-offering.mts and the investor directory panel. | The 15-step dashboard does not exist. Failure cases for an unauthorized issuer or a zero cap are not a product flow. |
| 8.2 L478 | The first wallet is verified with World ID, the backend creates the allocation id, and the wallet is registered onchain before the dashboard shows the limit. | IMPLEMENTED, NOT FULLY VERIFIED | The enroll route and submitRegistration. Tests cover portal rejection and a cancelled widget. | The World verification secret stays on the server. The live widget has not succeeded. Replay protection is the registration nonce, tested locally. |
| 8.3 L508 | A second wallet proves the same session and is registered to the same allocation id. The listed session and authorization failures are rejected. | IMPLEMENTED, NOT FULLY VERIFIED | continue and wallet-authorization tests, including expiry, reuse, and a wallet already linked elsewhere. | No existing session, an expired World session, and a proof for another person are covered by fixtures, not by a live World failure. |
| 8.4 L538 | A successful purchase quotes, executes through the trusted executor, and the hook checks the registered wallet, group, period, and remaining budget before updating spend. | PARTIALLY IMPLEMENTED | PoolExecutor.swapExactInput and the hook callbacks. The Anvil journey bought 700 and 200. | The hook does not validate a per-purchase signature or a policy version. There is no separate quote API. |
| 8.5 L577 | Wallet B's 500 purchase is rejected after Wallet A's 700, and the UI explains it. | IMPLEMENTED AND VERIFIED | Anvil journey and the investor copy for AllocationExceeded. | Demonstrated on Anvil. Not demonstrated on Sepolia. |
| 8.6 L598 | Bob verifies separately and has his own budget. | PARTIALLY IMPLEMENTED | The Anvil journey gives the second person a separate cap. | Bob's World ID verification has not happened. The Anvil second person is a second allocation id created by the script. |
| 8.7 L612 | Two pools in one group share one budget, so 600 plus 500 is rejected. | NOT IMPLEMENTED | No second pool and no test of this workflow. | The ledger could store it. The product does not demonstrate it. |
| 8.8 L625 | The issuer pauses an offering and the hook rejects later purchases. | PARTIALLY IMPLEMENTED | Hook pausePool, owner-only. The demo UI says the pool is paused. | Pause is per pool, not per offering policy. There is no issuer pause button on an offering. |
| 9.1 L641 | The purchase check is requested USDC against cap minus spend. | IMPLEMENTED AND VERIFIED | Hook afterSwap records the settled USDC input and the ledger reverts above the cap. | beforeSwap checks the estimated amount. The recorded amount is the settled USDC leg. |
| 9.2 L649 | The first version accounts in one USDC address. | IMPLEMENTED AND VERIFIED | Policy.usdc is fixed. Sepolia policy USDC matches the deployed mock. | A second quote token is not supported. |
| 9.3 L662 | Accounting is gross. Selling does not restore budget. | IMPLEMENTED AND VERIFIED | testSellingRwaDoesNotReduceSpend. | None. |
| 9.4 L667 | A failed transaction does not increase spend. | IMPLEMENTED AND VERIFIED | testLedgerRejectionRollsBackTheSwap and testInsufficientBalanceRollsBackSpend. | None. |
| 9.5 L671 | Only exact-input purchases count. | IMPLEMENTED AND VERIFIED | testExactOutputFromTheTrustedSenderRecordsNothing. The hook returns on non-negative amountSpecified. | None. |
| 9.6 L677 | Pools that share a group must share chain, quote token, period, hook, and executor. | PARTIALLY IMPLEMENTED | The deploy script wires one pool to those values. | The multi-pool rule is not exercised. |
| 9.7 L686 | Periods are independent. A new period does not inherit spend. | IMPLEMENTED AND VERIFIED | Ledger mappings include periodId. Tests cover a fresh period. | The product does not open a second period. |
| 9.8 L694 | An issuer may raise or lower the cap, pause, resume, and change an end date, with the six safety rules. | PARTIALLY IMPLEMENTED | setPolicy refuses a cap below spend and does not clear spend. The USDC address cannot be changed after it is set. | No policy version, no end date, and no versioned trade authorization. Pause is on the hook. Updates emit the ledger event that setPolicy already has. |
| 9.9 L709 | Retail uses World ID. Institutional wallets use an allowlist and a separate limit, and they do not skip every policy. | PARTIALLY IMPLEMENTED | setTier is the allowlist. The ledger cap still applies after the tier check. | The issuer cannot choose an unrestricted institutional allocation. |
| 9.10 L719 | Direct transfers, other exchanges, other pools, other chains, and other protocols are outside the cap. | IMPLEMENTED AND VERIFIED | README Limits. The hook cannot see those transfers. | This is a documented limit, not an enforcement bug. |
| 11.1 L800 | The credential is a World ID proof of human, not a document check. | IMPLEMENTED AND VERIFIED | Signup action and the README identity boundary. | None. |
| 11.2 L805 | Initial verification uses an action-scoped uniqueness proof and the server calls World's verify endpoint. | IMPLEMENTED, NOT FULLY VERIFIED | POST /api/world/enroll and the rp-context signature. | Live verify has not returned success. |
| 11.3 L815 | Additional wallets use a session proof, not a new uniqueness proof. | IMPLEMENTED, NOT FULLY VERIFIED | IDKit.proveSession in the continue client. Tests reject a uniqueness-shaped continuation. | Not exercised live. |
| 11.4 L820 | The allocation id is opaque and created by the backend after World accepts the proof. | IMPLEMENTED, NOT FULLY VERIFIED | enroll creates a random bytes32. It is not shown in the investor UI. | It is not issuer-scoped. |
| 11.5 L826 | The session reference is encrypted. The raw session id and raw nullifier are not stored. A duplicate proof returns 409. | IMPLEMENTED AND VERIFIED | AES-256-GCM enrollment store and the enroll tests. | The browser also keeps the session id in sessionStorage for the hackathon flow. That is disclosed in docs/development.md. |
| 11.6 L837 | Registration authorization is EIP-712, bound to wallet, allocation, group, expiry, nonce, chain, and ledger. | IMPLEMENTED AND VERIFIED | REGISTRATION_TYPEHASH and wallet-authorization tests. | None for the local verifier. |
| 11.7 L849 | The backend signer is a dedicated key, distinct from the World key, and the contract stores only the public address. | IMPLEMENTED AND VERIFIED | `backendSigner()` on Sepolia is `0x28FB61Dc27a37091f53C0c37b5026AdBbF5E1F46`. The derived allocation key and `ALLOCATION_AUTH_SIGNER_ADDRESS` match it. The World signer is a different address. | No rotation is required. The owner remains the deployer. |
| 11.8 L859 | Sessions and grants expire, and a lost session is not silently recovered. | PARTIALLY IMPLEMENTED | Continuation grants last about five minutes and are single use. | There is no recovery flow other than a new enrollment, which would be a new allocation id. |
| 11.9 L869 | World failures, cancellation, and an unavailable verifier do not register a wallet. | IMPLEMENTED AND VERIFIED | enrollmentAction and enroll portal-failure tests. | The unavailable-verifier case is a fixture, not a live outage. |
| 12.1 L886 | Onchain components are named HumanIdentityRegistry, RWAAllocationPolicyRegistry, an allocation ledger, the hook, and a trusted executor. | CONTRADICTED OR INCONSISTENT | The repository has AllocationLedger, RWAComplyHook, and PoolExecutor. | There is no HumanIdentityRegistry or RWAAllocationPolicyRegistry contract. Their jobs are folded into the ledger and the hook. |
| 12.2 L893 | The identity registry registers, reads, and revokes wallet links. | PARTIALLY IMPLEMENTED | registerWallet and allocationIdByWallet. | No revoke function. |
| 12.3 L925 | The policy registry stores id, group, issuer, USDC, cap, period, start, version, and an active flag, and versions do not erase spend. | PARTIALLY IMPLEMENTED | Policy is cap, periodId, and USDC. | No policy id, issuer, start, version, or active flag on the ledger. Hook pause is separate. |
| 12.4 L976 | The ledger stores cumulative spend and exposes it for the hook. | IMPLEMENTED AND VERIFIED | recordSpend, spentByAllocation, remaining. Only authorizedHook may record. | None. |
| 12.5 L994 | The hook checks the executor, the registered wallet, the group, the period, exact input, and the cap, then updates spend atomically with the swap. | IMPLEMENTED AND VERIFIED | beforeSwap and afterSwap. A recordSpend revert rolls the swap back. | It does not check a trade signature or a policy version. |
| 12.6 L1016 | Only the trusted executor may drive the protected swap. | IMPLEMENTED AND VERIFIED | testUntrustedRouterReverts and testDirectCallbackFromAnotherAddressIsRejected. | None. |
| 12.7 L1030 | Each purchase carries a signed trade intent with wallet, recipient, pool, policy, group, amount, period, policy version, nonce, expiry, chain, and route. | NOT IMPLEMENTED | No trade-intent type or verifier exists. | The implemented control is the trusted executor. The purchaser is msg.sender on PoolExecutor. |
| 12.8 L1060 | Accounting uses the settled USDC delta, including either token order. | IMPLEMENTED AND VERIFIED | testSettlement records and testUsdcAsCurrencyOneRecordsTheUsdcLeg. | None. |
| 12.9 L1070 | The spend update is atomic with the swap. | IMPLEMENTED AND VERIFIED | testLedgerRejectionRollsBackTheSwap. | None. |
| 12.10 L1074 | Registration, spend, policy changes, and rejections emit events. | PARTIALLY IMPLEMENTED | WalletRegistered and the spend events exist. | There is no event for a rejected purchase beyond the revert. Policy version events do not exist. |
| 12.11 L1124 | Custom errors cover the rejection cases the hook and ledger use. | IMPLEMENTED AND VERIFIED | `routerRejectionMessage` maps the cap, unregistered, paused, exact-input, quote-token, and untrusted-router errors, including their selectors. | Policy expiry has no contract error to map. |
| 13.1 L1149 | The app has home, directory, offering details, investor dashboard, linking, purchase, rejection, and issuer pages. | PARTIALLY IMPLEMENTED | /, /invest, /how, /demo, and the offering panel on /invest. | No separate offering-details route and no issuer offering workflow. |
| 13.2 L1161 | The home page explains the shared allocation and the Alice and Bob example. | IMPLEMENTED AND VERIFIED | frontend/components/product/Landing.tsx. | None. |
| 13.3 L1171 | The directory lists the public offering and its status. | IMPLEMENTED AND VERIFIED | The Public offering panel calls GET /api/offerings. Statuses include ready, missing, expired, mismatch, and unavailable. | It is one known offering, not a browsable catalog. |
| 13.4 L1185 | An offering details page shows the asset, pool, policy, and how to buy. | PARTIALLY IMPLEMENTED | The same investor page shows the offering and the purchase form. | There is no dedicated details route. |
| 13.5 L1200 | The investor dashboard shows the limit, spend, and remainder without the allocation id. | IMPLEMENTED, NOT FULLY VERIFIED | InvestorExperience reads cap, spend, and remaining. `GET /api/product/purchases` lists `SpendRecorded` amounts and transaction hashes for the connected wallet and omits the allocation id. | No Sepolia purchase exists, so the live list is empty. The list is one wallet, not every wallet in the allocation. |
| 13.6 L1218 | The linking UI continues an existing session and does not start a new enrollment. | IMPLEMENTED, NOT FULLY VERIFIED | The Second wallet section on /invest. | Not completed with a live session. |
| 13.7 L1228 | The purchase UI uses the supported executor, shows progress, and refreshes from the receipt. | IMPLEMENTED AND VERIFIED | SwapDemo and the investor purchase path. Anvil browser run covered Approving, Swapping, and Success. | Not repeated on Sepolia. |
| 13.8 L1241 | A rejected purchase names the remaining-budget reason and does not show success. | IMPLEMENTED AND VERIFIED | Anvil browser check of the over-budget purchase. | Not repeated in this session. |
| 13.9 L1251 | The issuer dashboard covers create, pause, and policy updates. | PARTIALLY IMPLEMENTED | AdminObservatory. | No create-offering action. |
| 13.10 L1264 | Layouts work on desktop, tablet, and a phone width. | IMPLEMENTED, NOT FULLY VERIFIED | The light theme and the earlier viewport pass. | This session did not repeat the 1440, 768, 390, and 360 checks. No UI code changed in Steps 6.5–6.10. |
| 14.1 L1273 | The backend verifies proofs, maps sessions to allocation ids, signs registration, and exposes reads. | IMPLEMENTED, NOT FULLY VERIFIED | The Next routes under frontend/app/api/world and /api/product/status. | There is no separate backend process. That is intentional. |
| 14.2 L1277 | The API covers enroll, session, continue, registration authorization, registration status, allocation, offerings, policy, publish, and query. | PARTIALLY IMPLEMENTED | enroll, continue, wallet-challenge, wallet-authorization, registration-receipt, product status, offerings. | Publish and query are CLI scripts, not HTTP routes. There is no standalone policy endpoint. |
| 14.4 L1321 | The session-proof API checks the proof against the stored session before it returns a grant. | IMPLEMENTED, NOT FULLY VERIFIED | POST /api/world/continue. | Not called with a live proof. |
| 14.5 L1329 | The registration API returns a one-time authorization and does not mark the wallet registered by itself. | IMPLEMENTED AND VERIFIED | The receipt route ignores a client success flag. The UI waits for the chain receipt. | None. |
| 14.6 L1339 | Storage keeps an encrypted session, an allocation id, and wallet association state without the raw nullifier. | IMPLEMENTED AND VERIFIED | The SQLite enrollment store. | Wallet association after registration is chain state. The database does not replace it. |
| 14.7 L1398 | Backend secrets stay off the client, inputs are validated, and errors do not echo secrets. | IMPLEMENTED AND VERIFIED | Server-only World and Arkiv clients. Tests reject browser construction and secret logging. | A full external review of every log line was not repeated in this audit. |
| 15.1 L1398 | Arkiv holds public offering data so the directory does not depend on one website database. | IMPLEMENTED AND VERIFIED | The Rabdi entity and GET /api/offerings. | None. |
| 15.2 L1401 | Arkiv stores the public offering description the product defined. | PARTIALLY IMPLEMENTED | Schema rwacomply-offering: project tag, offering id, symbol, token addresses, pool id, expiry. | The PRD example also names issuer, asset class, policy id, and policy version. Those were not part of the approved directory schema. |
| 15.3 L1422 | Arkiv must not store proofs, session ids, allocation spend, or private keys. | IMPLEMENTED AND VERIFIED | publishOffering refuses cap and spent fields. prize-doc tests forbid printing the access key. | None. |
| 15.4 L1434 | The publisher account is not an investor and is not the allocation signer. | IMPLEMENTED AND VERIFIED | Writer 0xbfBf7Ca4f33993fA8b918d38286dad927231FB72. It is not the deployer or the backend signer. | None. |
| 15.5 L1438 | The directory can be queried, including by issuer, asset class, chain, and expiry. | PARTIALLY IMPLEMENTED | The live query is projectTag and offeringId. Expired entities are reported by the directory status. | Issuer, asset class, and chain are not query fields. |
| 15.6 L1446 | Chain policy wins when Arkiv and Ethereum disagree. Arkiv cannot reject a swap. | IMPLEMENTED AND VERIFIED | describeOfferingDirectory and purchaseBoundary tests. The buy path does not call Arkiv. | None. |
| 15.7 L1457 | A stopped or missing Arkiv client leaves purchases available and says the directory is unavailable. | IMPLEMENTED AND VERIFIED | ARKIV_CLIENT_STOPPED and the offerings route tests. | None. |
| 15.8 L1464 | The submission names the entity, the writer, the query, and the reason spend stays onchain. | IMPLEMENTED AND VERIFIED | README and the five files under arkiv/. The query was read back in this audit. | None. |
| 16 L1477 | Security review covers wallet linking, replay, hook data, the router, the spend counter, sales, issuer changes, signer compromise, World downtime, Arkiv tampering, the oracle, and reentrancy. | PARTIALLY IMPLEMENTED | Sections 17.1–17.14 are implemented to the extent the rows below say. | There is no separate security review report beyond tests and this audit. |
| 17.1 L1495 | A second wallet of the same person shares the counter. | IMPLEMENTED AND VERIFIED | Shared-identity forge test. | Live linking is unverified. |
| 17.2 L1498 | A wallet cannot be attached without a verified proof and a signature from that wallet. | IMPLEMENTED AND VERIFIED | wallet-authorization recovers the signer. A bad signature is rejected. | None. |
| 17.3 L1505 | A registration authorization cannot be replayed. | IMPLEMENTED AND VERIFIED | Nonce consumption and the single-use grant test. | None. |
| 17.4 L1514 | A trade authorization cannot be replayed. | NOT APPLICABLE / SUPERSEDED | No per-trade authorization is issued, so there is no trade nonce to replay. | The PRD control was replaced by the trusted executor. See 12.7. |
| 17.5 L1525 | The trader cannot put an arbitrary address in hook data and have it accepted from an untrusted caller. | IMPLEMENTED AND VERIFIED | The hook reads the trader only from the trusted executor's callback encoding. Direct callbacks revert. | A malicious trusted executor could still mis-encode the trader. That is the trust assumption. |
| 17.6 L1532 | An unauthorized router cannot use the hook. | IMPLEMENTED AND VERIFIED | testUntrustedRouterReverts. | None. |
| 17.7 L1536 | Spend cannot be reset by a policy edit. | IMPLEMENTED AND VERIFIED | setPolicy keeps the spend mapping. | None. |
| 17.8 L1543 | Selling and buying again does not restore budget. | IMPLEMENTED AND VERIFIED | testSellingRwaDoesNotReduceSpend. | None. |
| 17.9 L1547 | A malicious issuer cannot erase spend or cut the cap below spend. | PARTIALLY IMPLEMENTED | The owner cannot set the cap below spend. | The owner can still pause the pool or raise the cap. There is no separate issuer role. |
| 17.10 L1555 | A compromised backend signer can authorize fake registrations until the signer is rotated. | PARTIALLY IMPLEMENTED | `setBackendSigner` is owner-only and does not clear registrations or spend. `docs/issuer-runbook.md` records the call. The live signer is the dedicated allocation signer, not the deployer. | Rotation has not been executed. There is no monitoring that detects a compromised key. |
| 17.11 L1566 | If World is unavailable, new enrollment stops and existing registered wallets can still be checked onchain. | PARTIALLY IMPLEMENTED | Portal failures do not create rows. Registered wallets are chain state. | Not demonstrated against a live World outage. |
| 17.12 L1572 | Tampered Arkiv metadata does not change the cap or authorize a purchase. | IMPLEMENTED AND VERIFIED | Mismatch status and the purchase boundary test. | None. |
| 17.13 L1580 | The mock oracle is not a production price source. | IMPLEMENTED AND VERIFIED | MockRWAOracle and the README statement that the tokens are not real-world assets. | None. |
| 17.14 L1584 | Spend and the swap stay consistent if an outer call reenters. | IMPLEMENTED, NOT FULLY VERIFIED | The spend update is in the swap callback and reverts roll back. | No dedicated reentrancy test was run as a named case beyond the rollback tests. |
| 17.15 L1593 | Proofs, the session id, and the allocation id are not published onchain or in the investor UI. | IMPLEMENTED AND VERIFIED | session_id does not appear under src. The investor UI does not show the allocation id. | sessionStorage holds the session id in the browser. That is a local copy, disclosed in the development doc. |
| 18 L1606 | The UI has a specific sentence for each listed failure: wallet, World, session, authorization, pause, expiry, cap, swap type, quote token, executor, revert, Arkiv, and backend. | PARTIALLY IMPLEMENTED | `frontend/lib/product/copy.ts` and `purchaseFlow.ts` use the section 18 sentences for the conditions the app can actually detect. | “This offering's allocation period has ended.” is not shown. The ledger has no end time, so that sentence would be false. |
| 19.1 L1647 | Identity acceptance: one human, many wallets, server-side verify, no onchain proof. | IMPLEMENTED, NOT FULLY VERIFIED | Tests and the contract storage layout. | Live World acceptance is open. |
| 19.2 L1655 | Wallet acceptance: signature, nonce, expiry, and one allocation per wallet. | IMPLEMENTED AND VERIFIED | wallet-authorization and registerWallet tests. | None. |
| 19.3 L1662 | Policy acceptance: cap, period, shared group, no spend reset. | PARTIALLY IMPLEMENTED | Ledger tests. | No version or end time. |
| 19.4 L1672 | Trading acceptance: exact input, shared budget, rejection, Bob's separate budget, no spend on failure. | IMPLEMENTED AND VERIFIED | AllocationJourney and the Anvil script. | Sepolia trading acceptance is open. |
| 19.5 L1683 | Frontend acceptance: the investor can see the budget and the rejection without sample data. | IMPLEMENTED, NOT FULLY VERIFIED | The investor page uses chain reads and says when data is unavailable. | Not shown for a registered Sepolia wallet. |
| 19.6 L1693 | Arkiv acceptance: public metadata, chain wins, purchase works while Arkiv is stopped. | IMPLEMENTED AND VERIFIED | Offering tests and the earlier stopped-client check. This audit re-read the entity. | The stopped-client browser check was not repeated in this session. |
| 20.1 L1704 | Security is covered by the threat rows and the tests above. | PARTIALLY IMPLEMENTED | forge test and npm run test:world. | No external audit. |
| 20.2 L1712 | The app fails closed when chain or directory data is missing. | IMPLEMENTED AND VERIFIED | Product status and the offerings route. | None. |
| 20.3 L1723 | Performance targets are stated. | NOT IMPLEMENTED | No latency, gas, or load measurement is recorded against a target. | A successful build is not a performance result. |
| 20.4 L1729 | The interface is understandable and the rejection reasons are plain. | IMPLEMENTED, NOT FULLY VERIFIED | The light investor pages and the rejection copy. | This session did not re-walk the UI. Older presentation components still describe the V1 tier check. |
| 20.5 L1736 | The contracts and the app are tested and documented. | IMPLEMENTED AND VERIFIED | 114 forge tests, 83 frontend tests, README, and docs/development.md. | docs/continuity/README.md still describes an older deployment state. |
| 20.6 L1736 | The stack is Ethereum, Uniswap v4, World ID, and Arkiv on the networks used here. | IMPLEMENTED AND VERIFIED | Sepolia chain id 11155111 and Rabdi chain id 7794095. | None. |
| 21.1 L1748 | Onchain data is the wallet, the allocation id, registration, policy, group, spend, and remaining. Proofs and session ids stay offchain. | IMPLEMENTED AND VERIFIED | Ledger mappings and the absence of session_id in src. | The identity registry named in the table is the ledger. |
| 21.2 L1785 | Backend data is the encrypted session, the allocation mapping, and authorization state. | IMPLEMENTED AND VERIFIED | The SQLite enrollment store. | None. |
| 21.3 L1798 | Arkiv data is public offering metadata and an expiry. | IMPLEMENTED AND VERIFIED | The live entity fields and expiresAt. | Policy id, asset category, and issuer wallet are not stored. See 15.2. |
| 22.1 L1821 | Unit tests cover registration, policy, and the ledger. | PARTIALLY IMPLEMENTED | Foundry ledger and journey tests passed. | Revocation, policy version, and a second pool are not in the suite. |
| 22.2 L1856 | Hook tests cover the unregistered wallet, the executor, exact output, the cap, a second wallet, a second pool, and spend rollback. | PARTIALLY IMPLEMENTED | The listed cases pass except revoked wallet, trade signature, trade nonce, inactive or expired policy, and a second pool. | Those missing cases have no implementation to test. |
| 22.4 L1905 | Backend tests cover proof rejection, grants, and authorization. | IMPLEMENTED AND VERIFIED | npm run test:world, 83 passed. | They use fixtures, not World production. |
| 22.5 L1917 | Arkiv tests cover the schema, the directory statuses, and the purchase boundary. | IMPLEMENTED AND VERIFIED | offering, client, and purchaseBoundary tests. | The live query is additional evidence, not a unit test. |
| 22.6 L1929 | End-to-end tests cover the two-wallet purchase. | PARTIALLY IMPLEMENTED | The Anvil script and an earlier browser pass of /demo. | No automated browser suite was run in this session. No Sepolia end-to-end purchase exists. |
| 23.1 L1953 | Identity is accepted when a real proof links two wallets to one id. | NOT IMPLEMENTED | The server path is ready. | The acceptance event has not happened. |
| 23.2 L1962 | Contracts are accepted when the shared budget holds on the deployed market. | PARTIALLY IMPLEMENTED | Sepolia code and policy were read in this audit. Forge tests pass. | No investor has spent on Sepolia. |
| 23.3 L1972 | Trading is accepted when 700, a rejected 500, and 200 are shown, with Bob separate. | PARTIALLY IMPLEMENTED | Anvil journey. | Not on Sepolia. |
| 23.4 L1981 | The frontend is accepted when those states are visible without fake balances. | IMPLEMENTED, NOT FULLY VERIFIED | The pages read chain state and label unavailable data. | A registered investor has not been shown. |
| 23.5 L1991 | Arkiv is accepted when the offering is published, readable, and not treated as the cap. | IMPLEMENTED AND VERIFIED | The entity, writer, and query were read during this audit. | None. |
| 24.1 L2005 | The demo can be set up on a local chain. | IMPLEMENTED AND VERIFIED | script/start_anvil_demo.sh and the Anvil journey. | None. |
| 24.2 L2020 | The demo sequence includes issuer setup, Alice, the second wallet, the rejection, and Bob. | PARTIALLY IMPLEMENTED | docs/demo-script.md and the Anvil script. | The spoken recording has not been made. World ID enrollment is still required for the live version. |
| 24.3 L2058 | Demo success requires the shared budget, the rejection, and the separate person. | PARTIALLY IMPLEMENTED | Those numbers were produced on Anvil. | They are not a recorded 720p demo and not a Sepolia demo. |
| 25.1 L2071 | Local development is documented. | IMPLEMENTED AND VERIFIED | README Run and docs/development.md. | None. |
| 25.2 L2081 | The contracts are on a public testnet. | IMPLEMENTED AND VERIFIED | Sepolia addresses in docs/sepolia-deployment.md. Code and policy were read in this audit. | The market has no investor activity. |
| 25.3 L2090 | Deployment order is ledger, tokens, hook, executor, pool, policy, then the offering. | IMPLEMENTED AND VERIFIED | script/DeploySepolia.s.sol and the Arkiv publish step after it. | None. |
| 25.4 L2112 | Environment variables for World, allocation, and Arkiv are named and kept in the root .env. | IMPLEMENTED AND VERIFIED | docs/development.md names them. No frontend env file was added. | Values were not printed. |
| 26.1 L2147 | Investor-facing copy does not call the check KYC and does not show the allocation id. | IMPLEMENTED AND VERIFIED | Landing, HowItWorks, and InvestorExperience. | None. |
| 26.2 L2155 | Issuer-facing copy explains what the issuer can and cannot change. | PARTIALLY IMPLEMENTED | README Limits. | There is no issuer guide for setPolicy, pause, or signer rotation. |
| 26.3 L2164 | Protocol monitoring covers purchases, rejections, and verification failures. | NOT IMPLEMENTED | No indexer or monitoring view. | Events exist onchain. Nothing collects them. |
| 27 L2181 | The recorded V2 decisions prefer a trusted executor, gross USDC, and Arkiv outside the swap path. | IMPLEMENTED AND VERIFIED | PoolExecutor, the ledger, and the purchase boundary. | The signed trade intent in the same risk table was not built. |
| 28 L2280 | The PRD phase plan is an implementation schedule. | NOT APPLICABLE / SUPERSEDED | The approved roadmap replaced this schedule. Phases 0–6 of that roadmap are the work that was done. | This section is not a second product spec. |
| 30.1 L2416 | The Uniswap submission explains the hook callbacks and points at the feedback form. | IMPLEMENTED AND VERIFIED | FEEDBACK.md. submissionDocs tests. | None. |
| 30.2 L2438 | The World submission records time to first success, one failure, one documentation gap, and AI attribution. | PARTIALLY IMPLEMENTED | docs/world-integration.md. | There is no measured time, because no live verification has succeeded. The note says that explicitly. |
| 30.3 L2465 | The Arkiv submission answers the existing-project questions in the five arkiv files and does not add Swarm. | IMPLEMENTED AND VERIFIED | arkiv/schema.md, friction.md, reach.md, why-arkiv.md, how-you-use-arkiv.md. arkiv/swarm.md is absent. | None. |
| 31 L2491 | The PRD sketches a contracts/ and backend/ tree. | NOT APPLICABLE / SUPERSEDED | The sketch is labeled as a proposed layout. The repo uses src/, script/, and the Next app under frontend/. | Not a compliance failure. |
| 32.1 L2571 | Core product success is the shared human budget on the supported purchase route. | PARTIALLY IMPLEMENTED | Anvil demonstration and forge tests. | Live World ID and a Sepolia investor purchase are still open. |
| 32.2 L2580 | Technical success is hook enforcement, tests, and the deployed market. | PARTIALLY IMPLEMENTED | 114 forge tests, Sepolia code present, policy cap 1000000000. | Multi-pool sharing and trade-intent signatures are absent. |
| 32.3 L2588 | Submission success is the repo history, the partner notes, the demo script, and the limits. | PARTIALLY IMPLEMENTED | README, FEEDBACK.md, arkiv notes, docs/demo-script.md, and docs/world-integration.md. | No demo video has been recorded. Step 6.10 did not create a commit. |

## D. Security and privacy findings

Confirmed:

- Registration authorization is EIP-712, single-use, and bound to chain, ledger, wallet, allocation, group, expiry, and nonce. Tests cover bad signatures, expiry, reuse, and a conflicting allocation.
- World proofs are verified on the server. A cancelled widget and a rejected proof do not register a wallet. The allocation id is not shown in the investor UI. `session_id` is not stored in the Solidity contracts.
- The session id is encrypted at rest. The browser copy in `sessionStorage` is disclosed in `docs/development.md`. It is a local copy, not chain data.
- Arkiv cannot change the cap. The purchase path does not call Arkiv. The publish path refuses spend fields.
- The hook rejects an untrusted router and a direct callback. Spend updates roll back with a failed swap. Selling does not reduce spend.
- The Sepolia backend signer is `0x28FB61Dc27a37091f53C0c37b5026AdBbF5E1F46`, not the deployer. The deployer owns the ledger and can call `setBackendSigner`. That call is documented and was not sent.

Not confirmed:

- No live World ID proof, so the production verify endpoint has not accepted a proof from this app.
- No dedicated reentrancy suite beyond the rollback tests.
- No external security review.

Inconsistent with the PRD, and intentional in the code that shipped:

- Section 12.7 asks for a signed trade intent on every purchase. `PoolExecutor.swapExactInput` does not require one. The trader is the executor's `msg.sender`, and the hook trusts that executor. That removes the trade-nonce control in section 17.4. It does not let an arbitrary router through.

## E. Functional and UX findings

- The Anvil script shows Wallet A buying 700, Wallet B's 500 reverting, Wallet B buying 200, and a second person keeping a separate cap. That is local chain 31337.
- Sepolia has the market and the policy. It has no enrolled investor and no investor purchase.
- `/invest` can show the offering, the cap, and the period. Remaining stays empty until a registered wallet is connected.
- There is no offering-details route, no create-offering issuer flow, and no purchase history.
- `AdminObservatory` still exposes V1 admin calls. `ProjectPresentation.tsx` still describes the check as a tier check. That copy is older than the allocation model.
- `docs/demo-script.md` is a script. No 720p recording exists, and the script says the World ID beats cannot be filmed yet.

## F. Integration and operational findings

- Root `.env` is the only environment file used. Names are documented. Values were not printed.
- Sepolia reads in this audit matched the documented USDC, cap, and period.
- The Arkiv entity was read again and not modified.
- World ID, the allocation signer, and the Arkiv publisher are different keys. The publisher is not an investor.
- `docs/continuity/README.md` is stale relative to the Sepolia deployment and should not be used as the deployment record.
- Directory queries do not filter by issuer, asset class, or chain. The approved offering schema does not have those fields.
- No indexer, no verification-failure monitor, and no measured performance numbers.

## G. Prioritized remediation backlog

### 1. Security or correctness blockers

| Priority | PRD | Expected | Actual | Evidence | Fix | Depends on | Test |
|---|---|---|---|---|---|---|---|
| High | 12.7, 17.4 | Every purchase has a signed, single-use trade intent, or the PRD is explicitly changed. | The trusted executor is the only gate. | `PoolExecutor.swapExactInput` | Write down the trusted-executor decision as a PRD exception, or add the intent. Do not add it silently in a later step. | Product decision | A forge test that a swapped intent cannot be reused, if the intent is built |
| Low | 17.10 | A compromised signer can be rotated by the owner. | The dedicated signer already matches. Rotation is documented and not executed. | Sepolia `backendSigner()` and `docs/issuer-runbook.md` | Send `setBackendSigner` only after a real compromise and a new approval. | Owner key | Read `backendSigner()` after the change |

### 2. Core functional gaps

| Priority | PRD | Expected | Actual | Evidence | Fix | Depends on | Test |
|---|---|---|---|---|---|---|---|
| Critical | 8.2, 23.1 | A real World ID proof enrolls Wallet A and links Wallet B. | Server code and fixture tests only. | `docs/world-integration.md` | The user completes the widget. Do not fake the proof. | World app and the configured RP | Two wallets share one `allocationIdByWallet` on the target chain |
| High | 8.5, 23.3 | The 700 / 500 / 200 journey on the deployed market. | Done on Anvil. Not done on Sepolia. | `script/demo_allocation_journey.sh` | After registration and an issuer tier, send the purchases with approval. | The row above | Receipts and `spentByAllocation` |
| High | 8.7, 4.2.6 | Two pools, one group, one budget. | One pool. No test. | Sepolia deployment | Deploy a second pool only with approval, or mark the goal out of scope. | A second token and pool | A forge test of 600 then a rejected 500 |
| High | 8.1, 13.9 | An issuer creates and pauses an offering from the app. | Owner scripts and V1 admin controls. | `AdminObservatory.tsx` | A minimal owner form for `setPolicy` and pause, or a documented cast sequence. | Owner wallet | A local transaction, then a chain read |
| Medium | 12.2 | A wallet link can be revoked. | No revoke function. | `AllocationLedger.sol` | Add revoke only if the product still wants it. | Design | A purchase by a revoked wallet reverts |
| Medium | 9.8, 12.3 | Policy version, start, and end. | Cap, period, and USDC only. | `Policy` struct | Add fields only if an offering needs them. The current demo has one open period. | Design | A purchase after the end time reverts |

### 3. Integration gaps

| Priority | PRD | Expected | Actual | Evidence | Fix | Depends on | Test |
|---|---|---|---|---|---|---|---|
| High | 7.3 | Allocation ids are scoped per issuer. | One id per enrollment. | Enrollment store | Needed only for a second issuer. | A second issuer | Two issuers, two ids, one person |
| Medium | 15.5 | Queries by issuer, asset class, and chain. | Query is project tag and offering id. | `offeringFilter` | Add fields only if the directory grows. The roadmap schema did not include them. | Schema change on a new entity, not an edit that duplicates the current one | `query:offering` still returns one row |
| Medium | 26.3 | Monitoring of purchases and verification failures. | Events exist. Nothing collects them. | No indexer | A read-only event query is enough for the demo. | RPC | A script prints `WalletRegistered` and spend events |

### 4. UX and accessibility gaps

| Priority | PRD | Expected | Actual | Evidence | Fix | Depends on | Test |
|---|---|---|---|---|---|---|---|
| Medium | 18 | A sentence for policy expiry, wrong quote token, and unauthorized executor. | Those states are generic reverts. | `SwapDemo.tsx` | Map the selectors if the contracts already revert with them. | None | A unit test of the mapper |
| Low | 20.4 | Current screens describe the allocation check. | `ProjectPresentation.tsx` still describes a tier check. | That component | Update the sentence when the presentation is next touched. | None | Read the rendered home section |
| Low | 13.10, 20.3 | Responsive layout and performance are measured. | Earlier viewport pass. No numbers. | This audit | Repeat the viewport pass after the next UI change. Do not invent timings. | Browser | 1440, 768, 390, and 360 with no overflow |

### 5. Documentation and maintenance gaps

| Priority | PRD | Expected | Actual | Evidence | Fix | Depends on | Test |
|---|---|---|---|---|---|---|---|
| Medium | 25.2 | One current deployment record. | `docs/continuity/README.md` is stale. | That file versus `docs/sepolia-deployment.md` | Point the continuity note at the deployment record. | None | A doc test that the stale "not broadcast" sentence is gone |
| Low | 30.2 | A measured time to first World ID success. | The note says the measurement does not exist. | `docs/world-integration.md` | Fill in the time only after a real success. | A live proof | The note contains a duration and the date |
| Low | 24.2 | A 2–4 minute spoken recording at 720p, with no AI voiceover. | The script exists. The video does not. | `docs/demo-script.md` | A person records it. Do not synthesize the voice. | The live or Anvil path chosen in the script | The file is between 2 and 4 minutes and at least 720p |

Mandatory before calling the PRD satisfied: a real World ID enrollment, Sepolia registration, and the shared-budget purchase on that market. The second pool, trade intents, revocation, and issuer dashboard are product decisions, not silent follow-up work.

Optional: schema fields the roadmap already replaced, performance numbers, and the spoken video.
