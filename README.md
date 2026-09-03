# Quotient

A limit order book and matching engine that implements price-time priority matching — the core mechanism behind how exchanges and trading venues execute orders.

Core engine implemented in **TypeScript**, with a **C++ port of the matching core** for direct performance comparison.

The optional live-data adapter consumes the IEX stock feed through Alpaca's
WebSocket API. IEX's former public API is retired; direct IEX TOPS/DEEP access
uses the licensed IEX-TP feed rather than WebSockets.

## Features

- Limit orders (buy/sell at a specified price or better) and market orders (immediate execution at best available price)
- Price-time priority matching: best price first, earliest order first among equal prices
- Partial fills across multiple resting orders
- Order cancellation and modification
- Trade log of all executions
- Order book depth query (aggregate quantity at each price level)

## Architecture

```
matchbook/
├── ts/
│   ├── src/
│   │   ├── order.ts             # Order model (id, side, type, price, qty, timestamp)
│   │   ├── trade.ts             # Trade model (price, qty, buy/sell order ids)
│   │   ├── orderBook.ts         # Bid/ask book — price levels as time-ordered queues
│   │   ├── matchingEngine.ts    # Matching logic: accepts orders, produces trades
│   │   └── api/                 # REST layer: submit orders, query book state
│   └── tests/
│       ├── orderBook.test.ts
│       └── matchingEngine.test.ts
├── cpp/
│   ├── src/
│   │   ├── OrderBook.cpp/.h
│   │   └── MatchingEngine.cpp/.h
│   ├── tests/
│   └── benchmarks/               # Throughput/latency comparison vs. TS engine
└── README.md
```

**Core data structures:** each side of the book (bids, asks) is a map of price → FIFO queue of orders at that price. Best bid/ask lookup uses a heap over price levels (max-heap for bids, min-heap for asks), giving O(1) top-of-book reads and O(log n) updates.

## Tech Stack

- **TypeScript / Node.js** — primary implementation, used for all core logic and the API layer
- **Vitest** — testing
- **C++** — performance-focused port of `OrderBook` and `MatchingEngine` only, used to benchmark against the TS implementation

## Getting Started

```bash
git clone https://github.com/Selasie5/quotient.git
cd matchbook/ts
npm install
npm test
```

Example usage:

```ts
import { MatchingEngine } from "./src/matchEngine";
import { createOrder } from "./src/order";

const engine = new MatchingEngine();

engine.submitOrder(createOrder({
  id: "sell-1",
  ownerId: "participant-a",
  type: "limit",
  side: "sell",
  price: 100,
  quantity: 5,
}));

const trades = engine.submitOrder(createOrder({
  id: "buy-1",
  ownerId: "participant-b",
  type: "market",
  side: "buy",
  quantity: 5,
}));

console.log(trades);
```

### REST API

Build and start the server with `npm run build` and `npm start`. The API exposes:

- `POST /orders`
- `PATCH /orders/:id`
- `DELETE /orders/:id`
- `GET /book`
- `GET /trades`
- `GET /market-data?symbol=AAPL`
- `GET /health`

To enable the live IEX adapter, provide `IEX_SYMBOL`, `APCA_API_KEY_ID`, and
`APCA_API_SECRET_KEY` in the environment. The current process owns one matching
engine, so configure one symbol. Alpaca quote sizes are round lots and are
converted to shares before synthetic bid/ask liquidity enters the engine.

## Roadmap

- [x] `Order` / `Trade` data models with test coverage
- [x] Core matching loop for limit orders (exact match, partial fill, no match)
- [x] Market orders
- [x] Cancel and modify
- [x] Self-trade prevention and partial-fill remainder handling
- [x] Book depth query
- [x] Trade log + minimal REST API (`POST /orders`, `DELETE /orders/:id`, `GET /book`)
- [x] Live IEX quote/trade stream through Alpaca WebSocket
- [x] C++ port of `OrderBook` and `MatchingEngine`, validated against equivalent behavior tests
- [x] Benchmark: throughput and latency percentiles, TypeScript vs. C++
- [ ] (Stretch) Minimal CLI or web UI to visualize live book state

## Design Decisions

*Recorded as they're made, so this doubles as a log of trade-offs for anyone reading the code:*

### Two-sided best-price lookup

The first two-sided book used a linear scan to find the lowest ask. That made the
side-routing behavior easy to verify, but repeated top-of-book reads were O(n).
After locking that behavior down with tests, the ask side moved to a min-heap,
mirroring the max-heap already used for bids. Insertion is O(log n), and a normal
best-price read is O(1) on either side.

Empty price levels are removed lazily. `bestPrice()` discards empty levels from
the top until it reaches a non-empty one. Each stale heap entry is discarded at
most once, so cleanup is amortized across price-level insertions without the
extra position bookkeeping required by an indexed heap.

### Exact-size matching removal

The first simple matcher selected the best resting order and then asked the book
to resolve the best price again when dequeueing it. Once the matching behavior
was covered by tests, removal was changed to use the selected order's side,
price, and ID directly. `PriceLevel` already indexes its order nodes by ID, so
the selected order is removed in O(1) without a second top-of-book lookup. Empty
price levels remain in their heaps until the existing lazy cleanup runs.

### Full matching loop and market orders

The matching loop consumes the opposite side in price-time order until the
incoming quantity is exhausted, liquidity runs out, or a limit price no longer
crosses. A partially filled resting order is reduced in place so it keeps its
FIFO position; a remaining incoming limit order rests with its original
timestamp. Market orders ignore price boundaries and any unfilled remainder
expires instead of entering the book.

After the correctness-first implementation was committed, the loop was reviewed
for a justified optimization. Producing `f` trades necessarily requires visiting
`f` resting orders. Each visit already uses the heap for top-of-book selection
and the price level's ID index for O(1) quantity updates or removal; O(log p)
heap work occurs only when lazy cleanup removes an exhausted price level. A more
complex batch path would not improve that lower bound, so further optimization
is deferred until benchmarks show a real bottleneck.

### Self-trade prevention

Orders may carry an `ownerId`, which is separate from the unique order ID. When
the next executable resting order has the same owner, the engine uses a
cancel-incoming policy: it preserves any earlier third-party fills, leaves the
self-owned resting order unchanged, and cancels the incoming remainder. Orders
without an owner ID continue to match normally for backward compatibility.

### Cancellation and modification lookup

The correctness-first cancel/modify implementation located an order by scanning
the bid and ask price levels. Once cancellation, repricing, and FIFO rules were
covered by tests, `OrderBook` added a global `ordersById` index. Lookup is now
O(1) instead of O(p) for `p` price levels. The index is updated on every add,
full fill, dequeue, cancellation, and cancel-and-replace modification; lifecycle
tests verify that completed IDs do not remain stale.

Reducing quantity in place preserves time priority. Increasing quantity or
changing price removes and re-enqueues the order, so it loses time priority.
When repricing through `MatchingEngine`, the replacement goes through normal
matching and therefore cannot leave the book crossed.

### Depth snapshots

`getDepth()` returns detached bid and ask snapshots aggregated from each price
level's running quantity. Bids are sorted highest first and asks lowest first;
empty levels retained by lazy heap deletion are excluded.

The correctness-first implementation rebuilds and sorts depth at query time in
O(p log p) for `p` visible price levels. The post-commit review deliberately did
not add a cache: matching, cancellation, and modification are expected to be
hotter than depth reads, and a cached view would add invalidation complexity to
every mutation. If benchmarks later show repeated depth queries dominate, a
versioned cache or ordered price index can be introduced behind the same API.

### Live IEX market data

IEX retired its public API in 2021. Its current direct TOPS and DEEP products use
IEX-TP and require market-data agreements, so the WebSocket adapter uses
Alpaca's `v2/iex` stream. Credentials are read only from environment variables.

Quotes and reported trades have different semantics. A quote contains bid/ask
prices and sizes, so the single configured symbol is represented as replaceable
synthetic external liquidity and processed through the matching engine. A
reported trade does not identify the aggressor side and therefore cannot be
faithfully replayed as an order; it is retained as an external observation and
served from `/market-data`, separately from engine executions in `/trades`.

The correctness-first socket client connected once and retained every observed
trade. The hardening pass adds bounded exponential reconnect backoff and stores
trade histories in circular buffers (10,000 engine executions and 1,000 external
ticks by default). This provides O(1) append with bounded memory so disconnects
or an unbounded stream cannot degrade a long-running API process.

### C++ port and benchmark methodology

The native port was implemented and committed first with scan-based order-ID
lookup. Its parity suite covers the TypeScript engine's observable matching,
priority, cancellation, modification, depth, self-trade, lazy-deletion, and
trade-log behavior. The follow-up optimization adds a global ID-to-order index.
Orders live in `std::list` nodes inside price levels, whose addresses remain
stable while the book's hash maps rehash, making indexed lookup and cancellation
O(1) without sacrificing FIFO order.

`npm run benchmark` builds C++ with MSVC Release settings and compiles the
TypeScript implementation before running identical deterministic workloads. It
records throughput and p50/p95/p99 batch latency, correctness checksums, Git
state, workload parameters, and machine/runtime metadata in `benchmarks/results`.
The exact workload definitions and interpretation limits are documented in
[`benchmarks/README.md`](benchmarks/README.md).

The first clean-state baseline (`2ba67db`, 200,000 operations per workload) is
stored in
[`benchmark-20260903-160300.json`](benchmarks/results/benchmark-20260903-160300.json):

| Workload | Runtime | Throughput (ops/s) | p50 (ns/op) | p95 (ns/op) | p99 (ns/op) |
| --- | --- | ---: | ---: | ---: | ---: |
| Match pairs | C++ | 1,912,210 | 458.6 | 856.5 | 1,013.8 |
| Match pairs | TypeScript | 1,263,386 | 554.1 | 2,396.6 | 3,321.1 |
| Cancel by ID | C++ | 3,379,669 | 235.7 | 530.9 | 694.6 |
| Cancel by ID | TypeScript | 3,333,833 | 262.8 | 443.6 | 775.9 |

On this run, C++ delivered 1.51x the matching throughput. Cancellation
throughput was within 1.4%, so the result does not support claiming a material
native advantage for that workload. These figures are a baseline rather than a
universal language comparison; process startup, runtime variance, hardware, and
workload shape all matter.



## License

MIT
