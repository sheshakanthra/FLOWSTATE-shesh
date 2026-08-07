import { signupSchema } from "@/lib/auth/schemas";
import { hashPassword } from "@/lib/auth/password";
import { createUser, getUserByEmail } from "@/lib/repos/users";

/**
 * Creates a user account only — no workspace is created or joined here.
 * Workspace creation and invitations are out of scope for this build (see
 * CLAUDE.md), so a freshly signed-up user has zero workspaces until an
 * Owner adds them directly in the database; the login page surfaces that
 * state rather than pretending an onboarding flow exists.
 */
export async function POST(request: Request) {
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Check the highlighted fields." }, { status: 400 });
  }

  const existing = await getUserByEmail(parsed.data.email);
  if (existing) {
    return Response.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await createUser({ email: parsed.data.email, passwordHash, name: parsed.data.name });

  return Response.json({ ok: true });
}
