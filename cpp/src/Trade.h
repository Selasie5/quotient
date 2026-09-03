#pragma once

#include "Order.h"

#include <cstdint>
#include <string>

namespace quotient {

struct Trade {
  double price;
  std::uint64_t quantity;
  std::string buy_order_id;
  std::string sell_order_id;
  std::int64_t timestamp{now_millis()};
};

}  // namespace quotient
