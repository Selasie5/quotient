import { createApiServer } from "./api/server";

const port = Number(process.env.PORT ?? 3000);
const server = createApiServer();

server.listen(port, () => {
  console.log(`Quotient API listening on http://localhost:${port}`);
});
