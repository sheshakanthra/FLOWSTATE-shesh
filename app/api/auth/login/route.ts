import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/auth/schemas";
import { verifyPassword } from "@/lib/auth/password";
import { getUserByEmail } from "@/lib/repos/users";
import { listWorkspacesForUser } from "@/lib/repos/workspaces";

// A structurally-valid but unreachable salt:hash pair (128 hex hash chars,
// matching password.ts's 64-byte scrypt key length), hashed against even
// when the user doesn't exist, so a response-time difference can't be used
// to enumerate registered emails.
const DUMMY_PASSWORD_HASH = `${"0".repeat(32)}:${"0".repeat(128)}`;

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const user = await getUserByEmail(parsed.data.email);
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !valid) {
    return Response.json({ error: "That email and password don't match." }, { status: 401 });
  }

  await createSession(user.id);

  const workspaces = await listWorkspacesForUser(user.id);
  return Response.json({ workspaceSlug: workspaces[0]?.slug ?? null });
}
