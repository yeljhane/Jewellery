import Link from "next/link";
import { cn } from "@/lib/utils";
import { navAllowed, isOwnerOrManager } from "@/lib/permissions";
import { LogoutButton } from "@/components/LogoutButton";
import { type InterfaceLanguage, navLabel } from "@/lib/localization";
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
  Wrench,
  Scale,
  Percent,
  Megaphone,
  Tags,
  Shield,
  Headphones,
  BadgePercent,
} from "lucide-react";

const nav = [
  { href: "/", labelKey: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", labelKey: "Analytics", icon: Sparkles },
  { href: "/inventory", labelKey: "Stock", icon: Gem },
  { href: "/inventory/serials", labelKey: "Serials", icon: Tags },
  { href: "/inventory/security", labelKey: "Security", icon: Shield },
  { href: "/materials", labelKey: "Materials", icon: Boxes },
  { href: "/manufacturing", labelKey: "Manufacturing", icon: Factory },
  { href: "/pos", labelKey: "POS", icon: Store },
  { href: "/sales", labelKey: "Sales", icon: ShoppingCart },
  { href: "/repairs", labelKey: "Repairs", icon: Wrench },
  { href: "/appraisals", labelKey: "Appraisals", icon: Scale },
  { href: "/purchases", labelKey: "Purchases", icon: Truck },
  { href: "/customers", labelKey: "Customers", icon: Users },
  { href: "/service", labelKey: "Service", icon: Headphones },
  { href: "/vat-refunds", labelKey: "VAT", icon: BadgePercent },
  { href: "/marketing", labelKey: "Marketing", icon: Megaphone },
  { href: "/suppliers", labelKey: "Suppliers", icon: Package },
  { href: "/karigars", labelKey: "Karigars", icon: Hammer },
  { href: "/rates", labelKey: "Rates", icon: Coins },
  { href: "/expenses", labelKey: "Expenses", icon: Receipt },
  { href: "/commissions", labelKey: "Commissions", icon: Percent },
  { href: "/accounting", labelKey: "Accounting", icon: BookOpen },
  { href: "/staff", labelKey: "Staff", icon: UserCog },
  { href: "/settings", labelKey: "Settings", icon: Settings },
];

export function AppSidebar({
  currentPath,
  userName,
  userRole,
  language = "AZ",
}: {
  currentPath: string;
  userName?: string | null;
  userRole?: string | null;
  language?: InterfaceLanguage;
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
              {navLabel(language, item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4">
        <p className="truncate text-sm text-white/80">{userName || "Staff"}</p>
        <p className="text-[11px] uppercase tracking-wider text-white/40">{role || "—"}</p>
        <div className="mt-3">
          <LogoutButton label={navLabel(language, "SignOut")} />
        </div>
      </div>
    </aside>
  );
}
