/** Role → allowed route prefixes (exact `/` or path start). */
export const ROLE_ROUTE_PREFIXES: Record<string, string[]> = {
  OWNER: ["*"],
  MANAGER: ["*"],
  SALES: [
    "/",
    "/inventory",
    "/pos",
    "/sales",
    "/customers",
    "/rates",
    "/suppliers",
    "/repairs",
    "/appraisals",
  ],
  ACCOUNTANT: ["/", "/accounting", "/expenses", "/customers", "/sales", "/commissions"],
  WORKSHOP: ["/", "/manufacturing", "/materials", "/inventory", "/repairs"],
};

const VIEW_ONLY_CREATE_BLOCK: Record<string, RegExp[]> = {
  ACCOUNTANT: [/^\/pos$/, /^\/sales\/new$/, /^\/sales\/[^/]+\/edit$/],
  WORKSHOP: [/^\/inventory\/new$/, /^\/inventory\/[^/]+\/edit$/],
};

export function canAccessPath(role: string, pathname: string): boolean {
  const prefixes = ROLE_ROUTE_PREFIXES[role];
  if (!prefixes) return false;
  if (prefixes.includes("*")) return true;

  const allowed = prefixes.some((p) =>
    p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")
  );
  if (!allowed) return false;

  const blocks = VIEW_ONLY_CREATE_BLOCK[role];
  if (blocks?.some((re) => re.test(pathname))) return false;

  return true;
}

export function navAllowed(role: string, href: string): boolean {
  return canAccessPath(role, href);
}

export const STAFF_ROLES = ["OWNER", "MANAGER", "SALES", "ACCOUNTANT", "WORKSHOP"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isOwnerOrManager(role?: string | null): boolean {
  return role === "OWNER" || role === "MANAGER";
}
