import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { isOwnerOrManager } from "@/lib/permissions";

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

declare module "next-auth" {
  interface User {
    role: string;
    employeeId: string;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
      employeeId: string;
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const username = parsed.data.username.trim().toLowerCase();
        const employee = await prisma.employee.findFirst({
          where: { username, active: true },
        });
        if (!employee?.passwordHash) return null;

        const ok = await bcrypt.compare(parsed.data.password, employee.passwordHash);
        if (!ok) return null;

        return {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          employeeId: employee.id,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.employeeId = user.employeeId;
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
        session.user.role = (token.role as string) || "";
        session.user.employeeId = (token.employeeId as string) || "";
      }
      return session;
    },
  },
});

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireRole(roles: string[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    throw new Error("Forbidden");
  }
  return session;
}

export async function requireOwnerOrManager() {
  const session = await requireAuth();
  if (!isOwnerOrManager(session.user.role)) {
    throw new Error("Forbidden");
  }
  return session;
}

export { canAccessPath } from "@/lib/permissions";
