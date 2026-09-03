#include "MatchingEngine.h"

#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <string>

using namespace quotient;

namespace {

void require(bool condition, const std::string& message) {
  if (!condition) throw std::runtime_error(message);
}

Order limit(std::string id, Side side, double price, std::uint64_t quantity,
            std::optional<std::string> owner = std::nullopt) {
  return {std::move(id), std::move(owner), OrderType::Limit, side, price,
          quantity};
}

Order market(std::string id, Side side, std::uint64_t quantity,
             std::optional<std::string> owner = std::nullopt) {
  return {std::move(id), std::move(owner), OrderType::Market, side, std::nullopt,
          quantity};
}

void test_two_sided_depth() {
  OrderBook book;
  book.add(limit("b1", Side::Buy, 100, 2));
  book.add(limit("b2", Side::Buy, 101, 3));
  book.add(limit("b3", Side::Buy, 100, 4));
  book.add(limit("a1", Side::Sell, 103, 5));
  book.add(limit("a2", Side::Sell, 102, 6));
  const auto depth = book.depth();
  require(depth.bids == std::vector<DepthLevel>{{101, 3}, {100, 6}},
          "bid depth must aggregate and sort descending");
  require(depth.asks == std::vector<DepthLevel>{{102, 6}, {103, 5}},
          "ask depth must sort ascending");
}

void test_price_time_and_partial_fills() {
  MatchingEngine engine;
  engine.submit(limit("a2", Side::Sell, 101, 3));
  engine.submit(limit("a1", Side::Sell, 100, 2));
  engine.submit(limit("a3", Side::Sell, 101, 4));
  const auto trades = engine.submit(limit("b1", Side::Buy, 101, 7));
  require(trades.size() == 3, "incoming order must sweep three resting orders");
  require(trades[0].sell_order_id == "a1" && trades[0].price == 100,
          "best price must execute first");
  require(trades[1].sell_order_id == "a2" && trades[2].sell_order_id == "a3",
          "equal prices must execute FIFO");
  require(engine.best_ask_order()->quantity == 2,
          "partial resting remainder must remain");
}

void test_market_and_self_trade_prevention() {
  MatchingEngine engine;
  engine.submit(limit("external", Side::Sell, 100, 2, "other"));
  engine.submit(limit("self", Side::Sell, 101, 4, "owner"));
  const auto trades = engine.submit(market("market-buy", Side::Buy, 6, "owner"));
  require(trades.size() == 1 && trades[0].quantity == 2,
          "market order must keep valid fills before prevention");
  require(engine.best_ask_order()->id == "self" &&
              engine.best_ask_order()->quantity == 4,
          "self-owned resting order must remain unchanged");
  require(!engine.best_bid().has_value(), "incoming remainder must be cancelled");
}

void test_cancel_and_modify_priority() {
  MatchingEngine engine;
  engine.submit(limit("first", Side::Buy, 100, 5));
  engine.submit(limit("second", Side::Buy, 100, 5));
  require(engine.modify("first", {.quantity = 3}).has_value(),
          "quantity decrease must succeed");
  require(engine.best_bid_order()->id == "first" &&
              engine.best_bid_order()->quantity == 3,
          "quantity decrease must preserve priority");
  require(engine.modify("first", {.quantity = 8}).has_value(),
          "quantity increase must succeed");
  require(engine.best_bid_order()->id == "second",
          "quantity increase must lose priority");
  require(engine.cancel("second"), "known order must cancel");
  require(!engine.cancel("missing"), "unknown order must not cancel");
}

void test_trade_log_is_bounded() {
  MatchingEngine engine(1);
  engine.submit(limit("a1", Side::Sell, 100, 1));
  engine.submit(limit("b1", Side::Buy, 100, 1));
  engine.submit(limit("a2", Side::Sell, 101, 1));
  engine.submit(limit("b2", Side::Buy, 101, 1));
  const auto trades = engine.trades();
  require(trades.size() == 1 && trades[0].price == 101,
          "trade log must retain newest entries");
}

void test_market_remainder_expires() {
  MatchingEngine engine;
  engine.submit(limit("ask", Side::Sell, 100, 2));
  const auto trades = engine.submit(market("market", Side::Buy, 5));
  require(trades.size() == 1 && trades[0].quantity == 2,
          "market order must consume available quantity");
  require(!engine.best_bid().has_value() && !engine.best_ask().has_value(),
          "market remainder must not rest");
}

void test_duplicate_ids_and_lazy_reactivation() {
  OrderBook book;
  book.add(limit("same", Side::Buy, 100, 1));
  bool rejected = false;
  try {
    book.add(limit("same", Side::Sell, 101, 1));
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  require(rejected, "duplicate ids must be rejected across sides");
  require(book.cancel("same"), "order must cancel");
  book.add(limit("replacement", Side::Buy, 100, 1));
  require(book.best_bid() == 100,
          "an empty price must reactivate before lazy cleanup");
}

void test_aggressive_repricing_matches() {
  MatchingEngine engine;
  engine.submit(limit("bid", Side::Buy, 99, 5));
  engine.submit(limit("ask", Side::Sell, 100, 5));
  const auto result = engine.modify("bid", {.price = 100});
  require(result.has_value() && result->size() == 1,
          "aggressive repricing must enter matching");
  require(!engine.best_bid().has_value() && !engine.best_ask().has_value(),
          "repriced match must not leave a crossed book");
}

void test_order_index_lifecycle() {
  MatchingEngine engine;
  engine.submit(limit("reusable", Side::Sell, 100, 1));
  engine.submit(limit("buyer", Side::Buy, 100, 1));
  engine.submit(limit("reusable", Side::Sell, 101, 1));
  require(engine.best_ask() == 101,
          "a fully matched id must be reusable without a stale index entry");
  require(engine.cancel("reusable"), "reused id must remain cancellable");
}

}  // namespace

int main() {
  try {
    test_two_sided_depth();
    test_price_time_and_partial_fills();
    test_market_and_self_trade_prevention();
    test_cancel_and_modify_priority();
    test_trade_log_is_bounded();
    test_market_remainder_expires();
    test_duplicate_ids_and_lazy_reactivation();
    test_aggressive_repricing_matches();
    test_order_index_lifecycle();
    std::cout << "All C++ order-book tests passed\n";
    return EXIT_SUCCESS;
  } catch (const std::exception& error) {
    std::cerr << "C++ test failure: " << error.what() << '\n';
    return EXIT_FAILURE;
  }
}
