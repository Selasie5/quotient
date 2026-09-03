#include "MatchingEngine.h"

#include <algorithm>
#include <stdexcept>
#include <utility>

namespace quotient {

MatchingEngine::MatchingEngine(std::size_t max_trade_log_size)
    : max_trade_log_size_(max_trade_log_size) {
  if (max_trade_log_size == 0) {
    throw std::invalid_argument("trade log size must be positive");
  }
}

std::vector<Trade> MatchingEngine::submit(Order incoming) {
  validate_order(incoming);
  std::vector<Trade> result;
  std::uint64_t remaining = incoming.quantity;
  bool prevented_self_trade = false;

  while (remaining > 0) {
    Order* resting = incoming.side == Side::Buy ? book_.best_ask_order()
                                                : book_.best_bid_order();
    if (resting == nullptr || !prices_cross(incoming, *resting)) break;
    if (same_owner(incoming, *resting)) {
      prevented_self_trade = true;
      break;
    }

    const std::uint64_t executed = std::min(remaining, resting->quantity);
    const Trade trade{*resting->price,
                      executed,
                      incoming.side == Side::Buy ? incoming.id : resting->id,
                      incoming.side == Side::Sell ? incoming.id : resting->id};
    if (executed == resting->quantity) {
      const Order copy = *resting;
      if (!book_.remove(copy)) throw std::runtime_error("failed to remove fill");
    } else if (!book_.reduce(*resting, executed)) {
      throw std::runtime_error("failed to reduce fill");
    }

    result.push_back(trade);
    record(trade);
    remaining -= executed;
  }

  if (remaining > 0 && incoming.type == OrderType::Limit &&
      !prevented_self_trade) {
    incoming.quantity = remaining;
    book_.add(std::move(incoming));
  }
  return result;
}

bool MatchingEngine::cancel(const std::string& order_id) {
  return book_.cancel(order_id);
}

std::optional<std::vector<Trade>> MatchingEngine::modify(
    const std::string& order_id, const OrderModification& changes) {
  Order* existing = book_.find(order_id);
  if (existing == nullptr) return std::nullopt;
  const bool price_changed = changes.price.has_value() &&
                             *changes.price != *existing->price;
  if (!price_changed) {
    book_.modify(order_id, changes);
    return std::vector<Trade>{};
  }

  Order replacement = *existing;
  replacement.price = changes.price;
  replacement.quantity = changes.quantity.value_or(existing->quantity);
  replacement.timestamp = now_millis();
  validate_order(replacement);
  if (!book_.cancel(order_id)) throw std::runtime_error("failed to modify order");
  return submit(std::move(replacement));
}

std::optional<double> MatchingEngine::best_bid() { return book_.best_bid(); }
std::optional<double> MatchingEngine::best_ask() { return book_.best_ask(); }
Order* MatchingEngine::best_bid_order() { return book_.best_bid_order(); }
Order* MatchingEngine::best_ask_order() { return book_.best_ask_order(); }
BookDepth MatchingEngine::depth() const { return book_.depth(); }
std::vector<Trade> MatchingEngine::trades() const {
  return {trade_log_.begin(), trade_log_.end()};
}

bool MatchingEngine::prices_cross(const Order& incoming,
                                  const Order& resting) {
  if (incoming.type == OrderType::Market) return true;
  return incoming.side == Side::Buy ? *incoming.price >= *resting.price
                                    : *incoming.price <= *resting.price;
}

bool MatchingEngine::same_owner(const Order& incoming, const Order& resting) {
  return incoming.owner_id.has_value() && incoming.owner_id == resting.owner_id;
}

void MatchingEngine::record(const Trade& trade) {
  if (trade_log_.size() == max_trade_log_size_) trade_log_.pop_front();
  trade_log_.push_back(trade);
}

}  // namespace quotient
