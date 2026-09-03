# Quotient benchmarks

The benchmark compares the TypeScript and C++ matching engines with identical,
deterministic workloads. It reports total throughput and p50/p95/p99 batch
latency normalized to nanoseconds per submitted or cancelled order.

## Workloads

- `match_pairs`: alternate one resting ask and one equal-size crossing bid.
  Every pair creates exactly one trade; each submission counts as one operation.
- `cancel_by_id`: populate one batch across 100 price levels, then time only the
  cancellation of every order by ID. Each cancellation counts as one operation.

Both binaries run 10,000 warmup operations before recording 200,000 operations
in batches of 1,000 by default. Batched clocks reduce measurement overhead. The
checksum must equal half the operations for `match_pairs` and all operations for
`cancel_by_id`; this guards against dead-code or workload errors.

## Interpretation

Use a Release C++ build and the compiled JavaScript output. Run on an otherwise
idle machine, repeat several times, and compare medians rather than treating one
run as definitive. These are in-process engine measurements; they deliberately
exclude HTTP, WebSocket, serialization, logging, and network latency.

Result files should include the Git commit, UTC timestamp, OS, CPU, Node version,
compiler/build mode, exact runner command, and raw metrics so changes remain
reproducible and reviewable. Only compare files whose `git_dirty` value is
`false`; otherwise the recorded commit does not fully identify the code tested.
