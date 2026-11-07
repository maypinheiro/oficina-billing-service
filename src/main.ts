import { createServer } from "node:http";
import { handleRequest } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
createServer(handleRequest).listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ level: "info", service: "oficina-billing-service", port }));
});
