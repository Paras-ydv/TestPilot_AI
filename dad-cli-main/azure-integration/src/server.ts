import Fastify from "fastify";
import { dbRoutes } from "./routes/db.routes";
import { visionRoutes } from "./routes/vision.routes";
import { monitorRoutes } from "./routes/monitor.routes";

const app = Fastify({ logger: true });

app.register(dbRoutes, { prefix: "/db" });
app.register(visionRoutes, { prefix: "/vision" });
app.register(monitorRoutes, { prefix: "/monitor" });

app.listen({ port: 5050 });
