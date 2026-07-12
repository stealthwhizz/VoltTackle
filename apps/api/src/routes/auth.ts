import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { LoginInputSchema } from "@volt-tackle/shared";
import { prisma } from "@volt-tackle/database";

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/api/auth/login", async (request, reply) => {
    const parsed = LoginInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "ValidationError", issues: parsed.error.issues });
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return reply.code(401).send({ error: "InvalidCredentials", message: "Email or password is incorrect." });
    }

    const token = await reply.jwtSign({ sub: user.id, email: user.email, role: user.role });

    return reply.send({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  });

  fastify.get("/api/auth/me", { preHandler: fastify.authenticate }, async (request, reply) => {
    return reply.send({ user: request.user });
  });
}
