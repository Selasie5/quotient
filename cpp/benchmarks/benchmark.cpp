#include "MatchingEngine.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <stdexcept>
#include <string>
#include <vector>

using quotient::MatchingEngine;
using quotient::Order;
using quotient::OrderType;
using quotient::Side;

namespace {

using Clock = std::chrono::steady_clock;

struct Metrics {
  std::string scenario;
  std::uint64_t operations;
  std::size_t batch_size;
  double throughput;
  double p50_ns;
  double p95_ns;
  double p99_ns;
  std::uint64_t checksum;
};

Order limit(std::string id, Side side, double price, std::uint64_t quantity) {
  return {std::move(id), std::nullopt, OrderType::Limit, side, price, quantity, 0};
}

double percentile(std::vector<double> values, double percentile_value) {
  std::sort(values.begin(), values.end());
  const auto index = static_cast<std::size_t>(
      std::ceil(percentile_value * static_cast<double>(values.size())) - 1);
  return values[std::min(index, values.size() - 1)];
}

template <typename Batch>
Metrics measure(const std::string& scenario, std::uint64_t operations,
                std::size_t batch_size, Batch&& run_batch) {
  const std::uint64_t batches = operations / batch_size;
  std::vector<double> samples;
  samples.reserve(static_cast<std::size_t>(batches));
  std::uint64_t checksum = 0;
  const auto total_start = Clock::now();
  for (std::uint64_t batch = 0; batch < batches; ++batch) {
    const auto start = Clock::now();
    checksum += run_batch(batch, batch_size);
    const auto elapsed = std::chrono::duration_cast<std::chrono::nanoseconds>(
                             Clock::now() - start)
                             .count();
    samples.push_back(static_cast<double>(elapsed) /
                      static_cast<double>(batch_size));
  }
  const double seconds = std::chrono::duration<double>(Clock::now() - total_start).count();
  return {scenario,
          batches * batch_size,
          batch_size,
          static_cast<double>(batches * batch_size) / seconds,
          percentile(samples, 0.50),
          percentile(samples, 0.95),
          percentile(samples, 0.99),
          checksum};
}

Metrics benchmark_match_pairs(std::uint64_t operations, std::size_t batch_size) {
  MatchingEngine engine;
  std::uint64_t next_id = 0;
  return measure("match_pairs", operations, batch_size,
                 [&](std::uint64_t, std::size_t size) {
                   std::uint64_t trades = 0;
                   for (std::size_t index = 0; index < size; index += 2) {
                     const double price = 100.0 + static_cast<double>(next_id % 10);
                     engine.submit(limit("ask-" + std::to_string(next_id), Side::Sell,
                                         price, 10));
                     trades += engine
                                   .submit(limit("bid-" + std::to_string(next_id),
                                                 Side::Buy, price, 10))
                                   .size();
                     ++next_id;
                   }
                   return trades;
                 });
}

Metrics benchmark_cancel_by_id(std::uint64_t operations,
                               std::size_t batch_size) {
  MatchingEngine engine;
  std::uint64_t next_id = 0;
  const std::uint64_t batches = operations / batch_size;
  std::vector<double> samples;
  samples.reserve(static_cast<std::size_t>(batches));
  std::uint64_t cancelled = 0;
  std::int64_t total_nanoseconds = 0;

  for (std::uint64_t batch = 0; batch < batches; ++batch) {
    std::vector<std::string> ids;
    ids.reserve(batch_size);
    for (std::size_t index = 0; index < batch_size; ++index) {
      ids.push_back("cancel-" + std::to_string(next_id++));
      engine.submit(limit(ids.back(), Side::Buy,
                          90.0 + static_cast<double>(index % 100), 1));
    }

    const auto start = Clock::now();
    for (const auto& id : ids) cancelled += engine.cancel(id) ? 1 : 0;
    const auto elapsed = std::chrono::duration_cast<std::chrono::nanoseconds>(
                             Clock::now() - start)
                             .count();
    total_nanoseconds += elapsed;
    samples.push_back(static_cast<double>(elapsed) /
                      static_cast<double>(batch_size));
  }

  const double seconds = static_cast<double>(total_nanoseconds) / 1'000'000'000.0;
  return {"cancel_by_id",
          operations,
          batch_size,
          static_cast<double>(operations) / seconds,
          percentile(samples, 0.50),
          percentile(samples, 0.95),
          percentile(samples, 0.99),
          cancelled};
}

void warm_up() {
  static_cast<void>(benchmark_match_pairs(10'000, 1'000));
  static_cast<void>(benchmark_cancel_by_id(10'000, 1'000));
}

void print_metrics(const Metrics& metrics, bool last) {
  std::cout << "    {\"scenario\":\"" << metrics.scenario
            << "\",\"operations\":" << metrics.operations
            << ",\"batch_size\":" << metrics.batch_size
            << ",\"throughput_ops_per_sec\":" << std::fixed
            << std::setprecision(2) << metrics.throughput
            << ",\"p50_ns_per_op\":" << metrics.p50_ns
            << ",\"p95_ns_per_op\":" << metrics.p95_ns
            << ",\"p99_ns_per_op\":" << metrics.p99_ns
            << ",\"checksum\":" << metrics.checksum << "}"
            << (last ? "\n" : ",\n");
}

}  // namespace

int main(int argc, char** argv) {
  const std::uint64_t operations = argc > 1 ? std::stoull(argv[1]) : 200'000;
  const std::size_t batch_size = argc > 2 ? std::stoull(argv[2]) : 1'000;
  if (operations < batch_size || operations % batch_size != 0 ||
      batch_size % 2 != 0) {
    std::cerr << "operations must be divisible by an even batch size\n";
    return EXIT_FAILURE;
  }

  warm_up();
  const auto matching = benchmark_match_pairs(operations, batch_size);
  const auto cancellation = benchmark_cancel_by_id(operations, batch_size);

  std::cout << "{\n  \"runtime\":\"cpp\",\n  \"metrics\":[\n";
  print_metrics(matching, false);
  print_metrics(cancellation, true);
  std::cout << "  ]\n}\n";
  return EXIT_SUCCESS;
}
