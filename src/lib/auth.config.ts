import type { NextAuthConfig } from "next-auth";
import { canAccessPath } from "@/lib/permissions";

export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET || "dev-avenue-joaillerie-change-me-in-production",
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      const isLoggedIn = !!auth?.user;
      const isPublic =
        pathname === "/login" ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico";

      if (isPublic) {
        if (isLoggedIn && pathname === "/login") {
          return Response.redirect(new URL("/", request.nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) return false;

      const role = (auth.user as { role?: string }).role || "";

      // Shared operational APIs for any signed-in staff
      if (pathname.startsWith("/api/exchange-rate")) {
        return true;
      }

      // Staff route + backup APIs
      if (pathname.startsWith("/staff") || pathname.startsWith("/api/backup")) {
        if (role !== "OWNER" && role !== "MANAGER") {
          return Response.redirect(new URL("/", request.nextUrl));
        }
        return true;
      }

      if (!canAccessPath(role, pathname)) {
        return Response.redirect(new URL("/", request.nextUrl));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.employeeId = (user as { employeeId?: string }).employeeId;
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
        (session.user as { role: string }).role = (token.role as string) || "";
        (session.user as { employeeId: string }).employeeId =
          (token.employeeId as string) || "";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
