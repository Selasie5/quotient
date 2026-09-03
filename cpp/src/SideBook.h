#pragma once

#include "Order.h"
#include "PriceLevel.h"

#include <algorithm>
#include <cstdint>
#include <functional>
#include <optional>
#include <queue>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace quotient {

struct DepthLevel {
  double price;
  std::uint64_t quantity;
  bool operator==(const DepthLevel&) const = default;
};

template <Side BookSide>
class SideBook {
 public:
  Order& add(Order order) {
    if (!order.price.has_value()) {
      throw std::invalid_argument("resting order requires a price");
    }
    const double price = *order.price;
    auto [level, inserted] = levels_.try_emplace(price);
    if (level->second.empty() && !prices_in_heap_.contains(price)) {
      prices_.push(price);
      prices_in_heap_.insert(price);
    }
    return level->second.enqueue(std::move(order));
  }

  std::optional<double> best_price() {
    discard_empty_prices();
    return prices_.empty() ? std::nullopt
                           : std::optional<double>{prices_.top()};
  }

  Order* best_order() {
    const auto price = best_price();
    return price.has_value() ? levels_.at(*price).front() : nullptr;
  }

  const Order* find(const std::string& order_id) const {
    for (const auto& [price, level] : levels_) {
      static_cast<void>(price);
      if (const Order* order = level.find(order_id); order != nullptr) {
        return order;
      }
    }
    return nullptr;
  }

  bool remove(const Order& order) {
    if (!order.price.has_value()) return false;
    const auto level = levels_.find(*order.price);
    return level != levels_.end() && level->second.remove(order.id);
  }

  bool reduce(const Order& order, std::uint64_t quantity) {
    if (!order.price.has_value()) return false;
    const auto level = levels_.find(*order.price);
    return level != levels_.end() && level->second.reduce(order.id, quantity);
  }

  std::vector<DepthLevel> depth() const {
    std::vector<DepthLevel> result;
    result.reserve(levels_.size());
    for (const auto& [price, level] : levels_) {
      if (!level.empty()) result.push_back({price, level.total_quantity()});
    }
    std::sort(result.begin(), result.end(), [](const auto& left, const auto& right) {
      if constexpr (BookSide == Side::Buy) {
        return left.price > right.price;
      } else {
        return left.price < right.price;
      }
    });
    return result;
  }

 private:
  using Comparator = std::conditional_t<BookSide == Side::Buy,
                                        std::less<double>,
                                        std::greater<double>>;
  std::unordered_map<double, PriceLevel> levels_;
  std::priority_queue<double, std::vector<double>, Comparator> prices_;
  std::unordered_set<double> prices_in_heap_;

  void discard_empty_prices() {
    while (!prices_.empty()) {
      const double price = prices_.top();
      const auto level = levels_.find(price);
      if (level != levels_.end() && !level->second.empty()) return;
      prices_.pop();
      prices_in_heap_.erase(price);
    }
  }
};

using BidBook = SideBook<Side::Buy>;
using AskBook = SideBook<Side::Sell>;

}  // namespace quotient
