import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { MatchingEngine } from "../matchEngine";
import { createOrder, CreateOrderInput } from "../order";
import { OrderModification } from "../orderBook";

const MAX_BODY_BYTES = 1_000_000;

export function createApiServer(
  engine: MatchingEngine = new MatchingEngine(),
): Server {
  return createServer((request, response) => {
    void handleRequest(engine, request, response);
  });
}

async function handleRequest(
  engine: MatchingEngine,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://localhost");

    if (method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (method === "GET" && url.pathname === "/book") {
      sendJson(response, 200, engine.getDepth());
      return;
    }

    if (method === "GET" && url.pathname === "/trades") {
      sendJson(response, 200, engine.getTrades());
      return;
    }

    if (method === "POST" && url.pathname === "/orders") {
      const order = createOrder(parseOrderInput(await readJson(request)));
      const trades = engine.submitOrder(order);
      sendJson(response, 201, { order, trades });
      return;
    }

    const orderId = orderIdFromPath(url.pathname);
    if (orderId !== undefined && method === "DELETE") {
      if (!engine.cancelOrder(orderId)) {
        sendJson(response, 404, { error: `Order ${orderId} was not found` });
        return;
      }

      response.writeHead(204).end();
      return;
    }

    if (orderId !== undefined && method === "PATCH") {
      const trades = engine.modifyOrder(
        orderId,
        parseModification(await readJson(request)),
      );

      if (trades === undefined) {
        sendJson(response, 404, { error: `Order ${orderId} was not found` });
        return;
      }

      sendJson(response, 200, { trades });
      return;
    }

    sendJson(response, 404, { error: "Route not found" });
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : "Invalid request",
    });
  }
}

function orderIdFromPath(pathname: string): string | undefined {
  const match = /^\/orders\/([^/]+)$/.exec(pathname);
  return match === null ? undefined : decodeURIComponent(match[1]);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body is too large");
    chunks.push(buffer);
  }

  if (chunks.length === 0) throw new Error("A JSON request body is required");
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function parseOrderInput(value: unknown): CreateOrderInput {
  const input = objectValue(value);
  if (typeof input.id !== "string" || input.id.trim() === "") {
    throw new Error("id must be a non-empty string");
  }
  if (input.type !== "limit" && input.type !== "market") {
    throw new Error("type must be limit or market");
  }
  if (input.side !== "buy" && input.side !== "sell") {
    throw new Error("side must be buy or sell");
  }
  if (!isFiniteNumber(input.quantity)) {
    throw new Error("quantity must be a finite number");
  }
  if (input.price !== undefined && !isFiniteNumber(input.price)) {
    throw new Error("price must be a finite number");
  }
  if (input.timestamp !== undefined && !isFiniteNumber(input.timestamp)) {
    throw new Error("timestamp must be a finite number");
  }
  if (input.ownerId !== undefined && typeof input.ownerId !== "string") {
    throw new Error("ownerId must be a string");
  }

  return input as unknown as CreateOrderInput;
}

function parseModification(value: unknown): OrderModification {
  const input = objectValue(value);
  if (input.price !== undefined && !isFiniteNumber(input.price)) {
    throw new Error("price must be a finite number");
  }
  if (input.quantity !== undefined && !isFiniteNumber(input.quantity)) {
    throw new Error("quantity must be a finite number");
  }
  if (input.price === undefined && input.quantity === undefined) {
    throw new Error("price or quantity is required");
  }

  return { price: input.price, quantity: input.quantity } as OrderModification;
}

function objectValue(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Request body must be a JSON object");
  }
  return value as Record<string, unknown>;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}
