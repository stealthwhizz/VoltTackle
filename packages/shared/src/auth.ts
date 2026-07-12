import { z } from "zod";
import { UserRoleSchema } from "./enums.js";

export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: UserRoleSchema,
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const JwtClaimsSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  role: UserRoleSchema,
});
export type JwtClaims = z.infer<typeof JwtClaimsSchema>;
