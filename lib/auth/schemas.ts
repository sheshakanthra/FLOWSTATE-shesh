import { z } from "zod";

/** Shared between the client forms (app/(auth)/login,signup) and the route
 *  handlers that receive their submissions (app/api/auth/*), per CLAUDE.md's
 *  "Schema shared between client and route handler." */
export const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email.").email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  email: z.string().trim().min(1, "Enter your email.").email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
});
export type SignupInput = z.infer<typeof signupSchema>;
