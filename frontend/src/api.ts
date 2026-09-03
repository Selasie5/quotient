import type {
  BookDepth,
  EngineSnapshot,
  MarketDataSnapshot,
  Order,
  PlaceOrderInput,
  PlaceOrderResult,
  Trade,
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body === undefined
      ? init?.headers
      : { "content-type": "application/json", ...init.headers },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(body?.error ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function getEngineSnapshot(symbol: string): Promise<EngineSnapshot> {
  const [book, orders, trades, marketData] = await Promise.all([
    request<BookDepth>("/book"),
    request<Order[]>("/orders"),
    request<Trade[]>("/trades"),
    request<MarketDataSnapshot>(`/market-data?symbol=${encodeURIComponent(symbol)}`),
  ]);

  return { book, orders, trades, marketData };
}

export function placeOrder(order: PlaceOrderInput): Promise<PlaceOrderResult> {
  return request<PlaceOrderResult>("/orders", {
    method: "POST",
    body: JSON.stringify(order),
  });
}

export function cancelOrder(orderId: string): Promise<void> {
  return request<void>(`/orders/${encodeURIComponent(orderId)}`, { method: "DELETE" });
}

export function modifyOrder(
  orderId: string,
  changes: { price?: number; quantity?: number },
): Promise<{ trades: Trade[] }> {
  return request<{ trades: Trade[] }>(`/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

export async function seedLiquidity(midPrice: number): Promise<void> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const levels = [0.02, 0.05, 0.09, 0.14, 0.21, 0.30];
  const orders: PlaceOrderInput[] = levels.flatMap((distance, index) => [
    {
      id: `seed-bid-${stamp}-${index}`,
      ownerId: `maker-bid-${index}`,
      type: "limit",
      side: "buy",
      price: Number((midPrice - distance).toFixed(2)),
      quantity: [400, 650, 900, 720, 1100, 840][index],
    },
    {
      id: `seed-ask-${stamp}-${index}`,
      ownerId: `maker-ask-${index}`,
      type: "limit",
      side: "sell",
      price: Number((midPrice + distance).toFixed(2)),
      quantity: [380, 740, 560, 980, 760, 1240][index],
    },
  ]);

  await Promise.all(orders.map(placeOrder));
}
