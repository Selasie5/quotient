import { MatchingEngine } from "../matchEngine";
import { createOrder, Side } from "../order";

interface Metrics {
  scenario: string;
  operations: number;
  batch_size: number;
  throughput_ops_per_sec: number;
  p50_ns_per_op: number;
  p95_ns_per_op: number;
  p99_ns_per_op: number;
  checksum: number;
}

function limit(id: string, side: Side, price: number, quantity: number) {
  return createOrder({ id, type: "limit", side, price, quantity, timestamp: 0 });
}

function percentile(values: number[], value: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(Math.ceil(value * sorted.length) - 1, sorted.length - 1)];
}

function measure(
  scenario: string,
  operations: number,
  batchSize: number,
  runBatch: (batch: number, size: number) => number,
): Metrics {
  const batches = operations / batchSize;
  const samples: number[] = [];
  let checksum = 0;
  const totalStart = process.hrtime.bigint();

  for (let batch = 0; batch < batches; batch += 1) {
    const start = process.hrtime.bigint();
    checksum += runBatch(batch, batchSize);
    samples.push(Number(process.hrtime.bigint() - start) / batchSize);
  }

  const seconds = Number(process.hrtime.bigint() - totalStart) / 1_000_000_000;
  return {
    scenario,
    operations,
    batch_size: batchSize,
    throughput_ops_per_sec: operations / seconds,
    p50_ns_per_op: percentile(samples, 0.5),
    p95_ns_per_op: percentile(samples, 0.95),
    p99_ns_per_op: percentile(samples, 0.99),
    checksum,
  };
}

function benchmarkMatchPairs(operations: number, batchSize: number): Metrics {
  const engine = new MatchingEngine();
  let nextId = 0;
  return measure("match_pairs", operations, batchSize, (_batch, size) => {
    let trades = 0;
    for (let index = 0; index < size; index += 2) {
      const price = 100 + nextId % 10;
      engine.submitOrder(limit(`ask-${nextId}`, "sell", price, 10));
      trades += engine.submitOrder(limit(`bid-${nextId}`, "buy", price, 10)).length;
      nextId += 1;
    }
    return trades;
  });
}

function benchmarkCancelById(operations: number, batchSize: number): Metrics {
  const engine = new MatchingEngine();
  let nextId = 0;
  const samples: number[] = [];
  let totalNanoseconds = 0;
  let cancelled = 0;

  for (let batch = 0; batch < operations / batchSize; batch += 1) {
    const ids: string[] = [];
    for (let index = 0; index < batchSize; index += 1) {
      const id = `cancel-${nextId++}`;
      ids.push(id);
      engine.submitOrder(limit(id, "buy", 90 + index % 100, 1));
    }

    const start = process.hrtime.bigint();
    for (const id of ids) cancelled += engine.cancelOrder(id) ? 1 : 0;
    const elapsed = Number(process.hrtime.bigint() - start);
    totalNanoseconds += elapsed;
    samples.push(elapsed / batchSize);
  }

  return {
    scenario: "cancel_by_id",
    operations,
    batch_size: batchSize,
    throughput_ops_per_sec: operations / (totalNanoseconds / 1_000_000_000),
    p50_ns_per_op: percentile(samples, 0.5),
    p95_ns_per_op: percentile(samples, 0.95),
    p99_ns_per_op: percentile(samples, 0.99),
    checksum: cancelled,
  };
}

const operations = Number(process.argv[2] ?? 200_000);
const batchSize = Number(process.argv[3] ?? 1_000);
if (
  !Number.isInteger(operations) ||
  !Number.isInteger(batchSize) ||
  operations < batchSize ||
  operations % batchSize !== 0 ||
  batchSize % 2 !== 0
) {
  throw new Error("operations must be divisible by an even batch size");
}

benchmarkMatchPairs(10_000, 1_000);
benchmarkCancelById(10_000, 1_000);

console.log(JSON.stringify({
  runtime: "typescript",
  node: process.version,
  metrics: [
    benchmarkMatchPairs(operations, batchSize),
    benchmarkCancelById(operations, batchSize),
  ],
}, null, 2));
