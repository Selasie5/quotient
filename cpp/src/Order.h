#pragma once

#include <chrono>
#include <cstdint>
#include <optional>
#include <stdexcept>
#include <string>

namespace quotient {

enum class Side { Buy, Sell };
enum class OrderType { Limit, Market };

inline std::int64_t now_millis() {
  return std::chrono::duration_cast<std::chrono::milliseconds>(
             std::chrono::system_clock::now().time_since_epoch())
      .count();
}

struct Order {
  std::string id;
  std::optional<std::string> owner_id;
  OrderType type;
  Side side;
  std::optional<double> price;
  std::uint64_t quantity;
  std::int64_t timestamp{now_millis()};
};

inline void validate_order(const Order& order) {
  if (order.id.empty()) throw std::invalid_argument("order id cannot be empty");
  if (order.owner_id.has_value() && order.owner_id->empty()) {
    throw std::invalid_argument("owner id cannot be empty");
  }
  if (order.quantity == 0) {
    throw std::invalid_argument("order quantity must be greater than 0");
  }
  if (order.type == OrderType::Limit &&
      (!order.price.has_value() || *order.price <= 0)) {
    throw std::invalid_argument("limit order requires a positive price");
  }
}

}  // namespace quotient
