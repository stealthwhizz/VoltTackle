import "fastify";
import type { JwtClaims } from "@volt-tackle/shared";
import type { AppContext } from "./context.js";
import type { AlertProducer } from "./kafka/producer.js";

declare module "fastify" {
  interface FastifyInstance {
    ctx: AppContext;
    alertProducer: AlertProducer;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: JwtClaims["role"][]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtClaims;
    user: JwtClaims;
  }
}
