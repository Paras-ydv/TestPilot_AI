import { FastifyRequest, FastifyReply } from "fastify";

export async function apiKeyAuth(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return reply.code(401).send({
      error: "API key missing (Middleware Endpoint Protection)"
    });
  }

  if (!process.env.API_KEY) {
    return reply.code(403).send({
      error: "Authentication failed"
    });
  }

  if (apiKey !== process.env.API_KEY) {
    return reply.code(403).send({
      error: "Authentication failed"
    });
  }
}
