#pragma once

#include "Order.h"
#include "SideBook.h"

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace quotient {

struct BookDepth {
  std::vector<DepthLevel> bids;
  std::vector<DepthLevel> asks;
};

struct OrderModification {
  std::optional<double> price;
  std::optional<std::uint64_t> quantity;
};

class OrderBook {
 public:
  Order& add(Order order);
  Order* find(const std::string& order_id);
  Order* best_bid_order();
  Order* best_ask_order();
  std::optional<double> best_bid();
  std::optional<double> best_ask();
  bool remove(const Order& order);
  bool reduce(const Order& order, std::uint64_t quantity);
  bool cancel(const std::string& order_id);
  bool modify(const std::string& order_id, const OrderModification& changes);
  BookDepth depth() const;

 private:
  BidBook bids_;
  AskBook asks_;
};

}  // namespace quotient
