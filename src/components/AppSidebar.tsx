import Link from "next/link";
import { cn } from "@/lib/utils";
import { navAllowed, isOwnerOrManager } from "@/lib/permissions";
import { signOutAction } from "@/lib/signout-action";
import {
  LayoutDashboard,
  Package,
  Factory,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Hammer,
  Coins,
  Receipt,
  Settings,
  Gem,
  Boxes,
  BookOpen,
  Sparkles,
  UserCog,
  LogOut,
  Wrench,
  Scale,
  Percent,
  Megaphone,
  Tags,
  Shield,
} from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", label: "AI Analytics", icon: Sparkles },
  { href: "/inventory", label: "Finished Stock", icon: Gem },
  { href: "/inventory/serials", label: "Serials", icon: Tags },
  { href: "/inventory/security", label: "Inv. Security", icon: Shield },
  { href: "/materials", label: "Raw Materials", icon: Boxes },
  { href: "/manufacturing", label: "Manufacturing", icon: Factory },
  { href: "/pos", label: "POS", icon: Store },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/repairs", label: "Repairs", icon: Wrench },
  { href: "/appraisals", label: "Appraisals", icon: Scale },
  { href: "/purchases", label: "Purchases", icon: Truck },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/suppliers", label: "Suppliers", icon: Package },
  { href: "/karigars", label: "Karigars", icon: Hammer },
  { href: "/rates", label: "Metal Rates", icon: Coins },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/commissions", label: "Commissions", icon: Percent },
  { href: "/accounting", label: "Accounting", icon: BookOpen },
  { href: "/staff", label: "Staff", icon: UserCog },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({
  currentPath,
  userName,
  userRole,
}: {
  currentPath: string;
  userName?: string | null;
  userRole?: string | null;
}) {
  const role = userRole || "";
  const items = nav.filter((item) => {
    if (
      item.href === "/staff" ||
      item.href === "/marketing" ||
      item.href === "/commissions" ||
      item.href === "/inventory/security"
    ) {
      return isOwnerOrManager(role);
    }
    return navAllowed(role, item.href);
  });

  return (
    <aside className="no-print flex h-full w-64 shrink-0 flex-col border-r border-white/10 bg-[var(--sidebar)] text-[var(--sidebar-fg)]">
      <div className="border-b border-white/10 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--gold)] text-[var(--ink)]">
            <Gem className="h-5 w-5" />
          </div>
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg leading-tight tracking-wide text-[var(--gold-soft)]">
              Avenue
            </p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Joaillerie</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? currentPath === "/"
              : currentPath === item.href || currentPath.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-[var(--gold)]/15 text-[var(--gold-soft)]"
                  : "text-white/65 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4">
        <p className="truncate text-sm text-white/80">{userName || "Staff"}</p>
        <p className="text-[11px] uppercase tracking-wider text-white/40">{role || "—"}</p>
        <form action={signOutAction} className="mt-3">
          <button
            type="submit"
            className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-[var(--gold-soft)]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
