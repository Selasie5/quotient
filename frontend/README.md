# Quotient trading simulator

The frontend is a React/Vite workstation over the Quotient REST API. It does
not reproduce matching logic in the browser: depth, working orders, trades,
cancellation, modification, and self-trade prevention remain authoritative in
the server-side engine.

## Run locally

From the repository root, start the API:

```powershell
npm run build
npm start
```

In a second terminal, install and start the frontend:

```powershell
npm --prefix frontend install
npm run frontend:dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to
`http://127.0.0.1:3000`, so development does not require permissive CORS
headers. Set `VITE_API_BASE_URL` when a deployed frontend reaches the API at a
different URL, and set `VITE_SYMBOL` to change the displayed symbol.

## Simulator workflow

1. Select **Seed book** to create balanced bid and ask liquidity when the engine
   is empty.
2. Select a depth row to prepare an order against that side of the market.
3. Submit limit or market orders from the ticket.
4. Review executions in the session chart and time-and-sales tape.
5. Modify or cancel the trader's resting limit orders in **My open orders**.

The fixed browser participant ID is `sim-trader`. Seed orders use distinct
maker IDs, allowing the engine's cancel-incoming self-trade protection to remain
visible and testable.

## Verification

```powershell
npm run frontend:test
npm run frontend:build
```

The UI includes loading, disconnected, empty, success, error, busy, hover,
focus, disabled, and reduced-motion states. Market transformation helpers have
focused unit tests; the server API contract is covered by the root test suite.
