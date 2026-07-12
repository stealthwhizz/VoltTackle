import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import type { JwtClaims } from "@volt-tackle/shared";

export default fp(async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(jwt, {
    secret: fastify.ctx.env.JWT_SECRET,
    sign: { expiresIn: fastify.ctx.env.JWT_EXPIRES_IN },
  });

  fastify.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: "Unauthorized", message: "Missing or invalid access token." });
    }
  });

  fastify.decorate("requireRole", (...roles: JwtClaims["role"][]) => {
    return async (request: Parameters<FastifyInstance["authenticate"]>[0], reply: Parameters<FastifyInstance["authenticate"]>[1]) => {
      const user = request.user;
      if (!user || !roles.includes(user.role)) {
        reply.code(403).send({ error: "Forbidden", message: `Requires one of roles: ${roles.join(", ")}` });
      }
    };
  });
});
