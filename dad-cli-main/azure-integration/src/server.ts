import Fastify from "fastify";
import { dbRoutes } from "./routes/db.routes.js";
import { visionRoutes } from "./routes/vision.routes.js";
import { monitorRoutes } from "./routes/monitor.routes.js";
import { graphRoutes } from "./routes/graph.routes.js";

const app = Fastify({ logger: true });

// Enable CORS for frontend integration
app.register(import('@fastify/cors'), {
  origin: true
});

app.register(dbRoutes, { prefix: "/db" });
app.register(visionRoutes, { prefix: "/vision" });
app.register(monitorRoutes, { prefix: "/monitor" });
app.register(graphRoutes, { prefix: "/graph" });

// Test route
app.get("/test", async () => {
  return { message: "Server is working" };
});

const start = async () => {
  try {
    await app.listen({ port: 5050, host: '0.0.0.0' });
    console.log('✅ Azure Integration Server running on http://localhost:5050');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
