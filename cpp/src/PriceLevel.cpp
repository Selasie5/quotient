#include "PriceLevel.h"

#include <stdexcept>
#include <utility>

namespace quotient {

Order& PriceLevel::enqueue(Order order) {
  if (orders_by_id_.contains(order.id)) {
    throw std::invalid_argument("duplicate order id: " + order.id);
  }
  total_quantity_ += order.quantity;
  orders_.push_back(std::move(order));
  auto iterator = std::prev(orders_.end());
  orders_by_id_.emplace(iterator->id, iterator);
  return *iterator;
}

Order* PriceLevel::front() {
  return orders_.empty() ? nullptr : &orders_.front();
}

bool PriceLevel::remove(const std::string& order_id) {
  const auto found = orders_by_id_.find(order_id);
  if (found == orders_by_id_.end()) return false;
  total_quantity_ -= found->second->quantity;
  orders_.erase(found->second);
  orders_by_id_.erase(found);
  return true;
}

bool PriceLevel::reduce(const std::string& order_id, std::uint64_t quantity) {
  const auto found = orders_by_id_.find(order_id);
  if (found == orders_by_id_.end()) return false;
  if (quantity == 0 || quantity >= found->second->quantity) {
    throw std::invalid_argument("reduction must leave a positive remainder");
  }
  found->second->quantity -= quantity;
  total_quantity_ -= quantity;
  return true;
}

bool PriceLevel::empty() const noexcept { return orders_.empty(); }

std::uint64_t PriceLevel::total_quantity() const noexcept {
  return total_quantity_;
}

}  // namespace quotient
