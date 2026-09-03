cmake_minimum_required(VERSION 3.20)
project(quotient_cpp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(quotient_core
  src/MatchingEngine.cpp
  src/OrderBook.cpp
  src/PriceLevel.cpp
)
target_include_directories(quotient_core PUBLIC src)

if(MSVC)
  target_compile_options(quotient_core PRIVATE /W4 /permissive-)
else()
  target_compile_options(quotient_core PRIVATE -Wall -Wextra -Wpedantic)
endif()

enable_testing()
add_executable(quotient_cpp_tests tests/order_book_tests.cpp)
target_link_libraries(quotient_cpp_tests PRIVATE quotient_core)
add_test(NAME quotient_cpp_tests COMMAND quotient_cpp_tests)
