#pragma once

#include "OrderBook.h"
#include "Trade.h"

#include <cstddef>
#include <deque>
#include <optional>
#include <string>
#include <vector>

namespace quotient {

class MatchingEngine {
 public:
  explicit MatchingEngine(std::size_t max_trade_log_size = 10'000);
  std::vector<Trade> submit(Order incoming);
  bool cancel(const std::string& order_id);
  std::optional<std::vector<Trade>> modify(
      const std::string& order_id, const OrderModification& changes);
  std::optional<double> best_bid();
  std::optional<double> best_ask();
  Order* best_bid_order();
  Order* best_ask_order();
  BookDepth depth() const;
  std::vector<Trade> trades() const;

 private:
  OrderBook book_;
  std::deque<Trade> trade_log_;
  std::size_t max_trade_log_size_;

  static bool prices_cross(const Order& incoming, const Order& resting);
  static bool same_owner(const Order& incoming, const Order& resting);
  void record(const Trade& trade);
};

}  // namespace quotient
