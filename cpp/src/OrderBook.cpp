#include "OrderBook.h"

#include <stdexcept>
#include <utility>

namespace quotient {

Order& OrderBook::add(Order order) {
  validate_order(order);
  if (find(order.id) != nullptr) {
    throw std::invalid_argument("duplicate order id: " + order.id);
  }
  return order.side == Side::Buy ? bids_.add(std::move(order))
                                 : asks_.add(std::move(order));
}

Order* OrderBook::find(const std::string& order_id) {
  if (const Order* order = bids_.find(order_id); order != nullptr) {
    return const_cast<Order*>(order);
  }
  return const_cast<Order*>(asks_.find(order_id));
}

Order* OrderBook::best_bid_order() { return bids_.best_order(); }
Order* OrderBook::best_ask_order() { return asks_.best_order(); }
std::optional<double> OrderBook::best_bid() { return bids_.best_price(); }
std::optional<double> OrderBook::best_ask() { return asks_.best_price(); }

bool OrderBook::remove(const Order& order) {
  return order.side == Side::Buy ? bids_.remove(order) : asks_.remove(order);
}

bool OrderBook::reduce(const Order& order, std::uint64_t quantity) {
  return order.side == Side::Buy ? bids_.reduce(order, quantity)
                                 : asks_.reduce(order, quantity);
}

bool OrderBook::cancel(const std::string& order_id) {
  const Order* order = find(order_id);
  if (order == nullptr) return false;
  const Order copy = *order;
  return remove(copy);
}

bool OrderBook::modify(const std::string& order_id,
                       const OrderModification& changes) {
  Order* order = find(order_id);
  if (order == nullptr) return false;
  const double price = changes.price.value_or(*order->price);
  const std::uint64_t quantity = changes.quantity.value_or(order->quantity);
  if (price <= 0 || quantity == 0) {
    throw std::invalid_argument("modified price and quantity must be positive");
  }

  const bool price_changed = price != *order->price;
  const bool quantity_increased = quantity > order->quantity;
  if (!price_changed && !quantity_increased) {
    if (quantity < order->quantity) return reduce(*order, order->quantity - quantity);
    return true;
  }

  Order replacement = *order;
  if (!remove(replacement)) throw std::runtime_error("failed to remove order");
  replacement.price = price;
  replacement.quantity = quantity;
  replacement.timestamp = now_millis();
  add(std::move(replacement));
  return true;
}

BookDepth OrderBook::depth() const { return {bids_.depth(), asks_.depth()}; }

}  // namespace quotient
