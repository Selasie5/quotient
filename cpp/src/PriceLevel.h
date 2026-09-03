#pragma once

#include "Order.h"

#include <cstdint>
#include <list>
#include <string>
#include <unordered_map>

namespace quotient {

class PriceLevel {
 public:
  Order& enqueue(Order order);
  Order* front();
  const Order* find(const std::string& order_id) const;
  bool remove(const std::string& order_id);
  bool reduce(const std::string& order_id, std::uint64_t quantity);
  [[nodiscard]] bool empty() const noexcept;
  [[nodiscard]] std::uint64_t total_quantity() const noexcept;

 private:
  using Iterator = std::list<Order>::iterator;
  std::list<Order> orders_;
  std::unordered_map<std::string, Iterator> orders_by_id_;
  std::uint64_t total_quantity_{0};
};

}  // namespace quotient
