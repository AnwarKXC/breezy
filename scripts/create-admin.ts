// Creates (or re-activates) an admin account.
//   pnpm admin:create [--email admin@example.com] [--name "Admin"] [--phone 0100...]
// Email defaults to ADMIN_EMAIL. The password is read from ADMIN_PASSWORD; when
// it is not set a random one is generated and printed once.
import "dotenv/config";

import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";

import { hashPassword } from "@/services/auth/password";
import { prisma } from "@/services/db/prisma";

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      phone: { type: "string" },
    },
  });

  const email = (values.email ?? process.env.ADMIN_EMAIL)?.trim().toLowerCase();
  const name = values.name?.trim() || "Admin";
  if (!email) {
    throw new Error('Set ADMIN_EMAIL or run: pnpm admin:create --email <email> [--name "<name>"]');
  }

  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD ?? randomBytes(12).toString("base64url");
  if (password.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters");

  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    const user = await tx.users.upsert({
      where: { email },
      create: { email, password_hash: passwordHash },
      update: { password_hash: passwordHash, is_active: true, updated_at: new Date() },
    });
    await tx.profiles.upsert({
      where: { id: user.id },
      create: { id: user.id, email, name, phone: values.phone ?? null, role: "admin" },
      update: { name, role: "admin", deleted_at: null },
    });
    await tx.sessions.deleteMany({ where: { user_id: user.id } });
  });

  console.log(`Admin ready: ${email}`);
  if (generated) console.log(`Generated password (shown once): ${password}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
