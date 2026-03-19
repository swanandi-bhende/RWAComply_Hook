# RWAComplyHook (Uniswap v4)

RWAComplyHook is a Uniswap v4 hook for specialized, compliance-aware markets.
It enforces tier-based access, retail caps, volatility-aware dynamic fees, and admin safeguards during swap flow.

## Demo

- Demo video: (https://youtu.be/oxLZlcRivwM)
- Full workflow: [full_workflow.md](full_workflow.md)
- Detailed test reference with all cases, commands: [docs/test_cases.md](docs/test_cases.md)

## Core Features

- Tier-based compliance access:
  - Tier 0: blocked
  - Tier 1: retail (capped)
  - Tier 2: institutional
- Dynamic fees based on oracle volatility and user tier
- Admin controls:
  - pause and unpause
  - set retail cap
  - set volatility threshold
  - update oracle address
- PoolManager integration tests on the real hook call path

## Repository Layout

- `src/RWAComplyHook.sol` - main hook logic
- `src/MockRWAOracle.sol` - volatility oracle
- `src/PoolExecutor.sol` - swap execution helper
- `src/MockERC20.sol` - demo tokens
- `test/RWAComply.t.sol` - hook unit tests
- `test/RWAComplyIntegration.t.sol` - PoolManager integration tests
- `script/DeployFull.s.sol` - canonical local deployment flow
- `script/run_canonical_demo.sh` - one-command demo run
- `frontend/` - interactive UI and presentation page
- `docs/demo_run_log.txt` - reproducible local run output

## Quick Start (Local)

1. Start local chain:

```bash
anvil
```

2. Deploy and run canonical flow:

```bash
bash script/run_canonical_demo.sh
```

3. Start frontend:

```bash
cd frontend
npm install
npm run dev
```

4. Open:

`http://localhost:3000`

## Run Tests

```bash
forge test
```

## License

MIT
