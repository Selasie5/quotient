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
import { MatchingEngine } from "./src/matchingEngine";

const engine = new MatchingEngine();

engine.submitLimitOrder({ side: "buy", price: 101, quantity: 10 });
engine.submitLimitOrder({ side: "sell", price: 100, quantity: 5 });
// -> produces a Trade for 5 units at price 100/101 depending on resting side

console.log(engine.getBookDepth());
```

## Roadmap

- [ ] `Order` / `Trade` data models with full test coverage
- [ ] Core matching logic for limit orders (exact match, partial fill, no match)
- [ ] Market orders, cancel, modify
- [ ] Edge cases: self-trade prevention, partial-fill remainder handling, book depth query
- [ ] Trade log + minimal REST API (`POST /orders`, `DELETE /orders/:id`, `GET /book`)
- [ ] C++ port of `OrderBook` and `MatchingEngine`, validated against the TS test suite
- [ ] Benchmark: orders/sec, TS vs. C++ implementation
- [ ] (Stretch) Minimal CLI or web UI to visualize live book state

## Design Decisions

*Recorded as they're made, so this doubles as a log of trade-offs for anyone reading the code:*

### Bid-side best-price lookup

The bid book keeps its price levels in a map and their prices in a max-heap. This
makes insertion O(log n) and returns the highest bid in O(1) when the heap's top
entry is active.

Empty price levels are removed lazily. `bestPrice()` discards empty levels from
the top until it reaches a non-empty one. Each stale heap entry is discarded at
most once, so cleanup is amortized across price-level insertions without the
extra position bookkeeping required by an indexed heap.



## License

MIT
