import { createApiServer } from "./api/server";
import { MatchingEngine } from "./matchEngine";
import { AlpacaIexClient } from "./marketData/alpacaIexClient";
import { IexQuoteBridge } from "./marketData/iexQuoteBridge";
import { MarketDataStore } from "./marketData/store";

const port = Number(process.env.PORT ?? 3000);
const engine = new MatchingEngine();
const marketData = new MarketDataStore();
const server = createApiServer(engine, marketData);
const symbol = process.env.IEX_SYMBOL?.trim().toUpperCase();
const keyId = process.env.APCA_API_KEY_ID;
const secretKey = process.env.APCA_API_SECRET_KEY;

let marketDataClient: AlpacaIexClient | undefined;
if (symbol !== undefined && keyId !== undefined && secretKey !== undefined) {
  const quoteBridge = new IexQuoteBridge(engine, symbol);
  marketDataClient = new AlpacaIexClient({
    keyId,
    secretKey,
    symbols: [symbol],
    onEvent: (event) => {
      marketData.record(event);
      if (event.type === "quote") quoteBridge.process(event);
    },
    onError: (error) => console.error("IEX market-data error:", error.message),
  });
  marketDataClient.connect();
}

server.listen(port, () => {
  console.log(`Quotient API listening on http://localhost:${port}`);
});

function shutDown(): void {
  marketDataClient?.close();
  server.close();
}

process.once("SIGINT", shutDown);
process.once("SIGTERM", shutDown);
