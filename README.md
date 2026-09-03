# Quotient

A limit order book and matching engine that implements price-time priority matching — the core mechanism behind how exchanges and trading venues execute orders.

Core engine implemented in **TypeScript**, with a **C++ port of the matching core** for direct performance comparison.

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

## Roadmap

- [x] `Order` / `Trade` data models with test coverage
- [x] Core matching loop for limit orders (exact match, partial fill, no match)
- [x] Market orders
- [ ] Cancel and modify
- [x] Self-trade prevention and partial-fill remainder handling
- [ ] Book depth query
- [ ] Trade log + minimal REST API (`POST /orders`, `DELETE /orders/:id`, `GET /book`)
- [ ] C++ port of `OrderBook` and `MatchingEngine`, validated against the TS test suite
- [ ] Benchmark: orders/sec, TS vs. C++ implementation
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



## License

MIT
