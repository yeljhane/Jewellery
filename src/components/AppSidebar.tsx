"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
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
  BriefcaseBusiness,
  ChevronDown,
} from "lucide-react";

type NavItem = {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  relatedPaths?: string[];
};

const reportingNav: NavItem[] = [
  { href: "/", labelKey: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", labelKey: "Analytics", icon: Sparkles },
];

const transactionalNav: NavItem[] = [
  { href: "/accounting", labelKey: "Accounting", icon: BookOpen },
  { href: "/appraisals", labelKey: "Appraisals", icon: Scale },
  { href: "/commissions", labelKey: "Commissions", icon: Percent },
  { href: "/service", labelKey: "Service", icon: Headphones },
  { href: "/expenses", labelKey: "Expenses", icon: Receipt },
  {
    href: "/inventory/security",
    labelKey: "Security",
    icon: Shield,
    relatedPaths: [
      "/inventory/audit",
      "/inventory/counts",
      "/inventory/locations",
      "/inventory/movements",
      "/inventory/transfers",
    ],
  },
  { href: "/manufacturing", labelKey: "Manufacturing", icon: Factory },
  { href: "/marketing", labelKey: "Marketing", icon: Megaphone },
  { href: "/pos", labelKey: "POS", icon: Store },
  { href: "/purchases", labelKey: "Purchases", icon: Truck },
  { href: "/repairs", labelKey: "Repairs", icon: Wrench },
  { href: "/sales", labelKey: "Sales", icon: ShoppingCart },
  { href: "/inventory/serials", labelKey: "Serials", icon: Tags },
  { href: "/vat-refunds", labelKey: "VAT", icon: BadgePercent },
];

const managementNav: NavItem[] = [
  { href: "/inventory", labelKey: "Stock", icon: Gem },
  { href: "/materials", labelKey: "Materials", icon: Boxes },
  { href: "/customers", labelKey: "Customers", icon: Users },
  { href: "/suppliers", labelKey: "Suppliers", icon: Package },
  { href: "/karigars", labelKey: "Karigars", icon: Hammer },
  { href: "/rates", labelKey: "Rates", icon: Coins },
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
  const pathname = usePathname() || currentPath;
  const navRef = useRef<HTMLElement>(null);
  const allowedItems = (items: NavItem[]) => items.filter((item) => {
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
  const reportingItems = allowedItems(reportingNav);
  const transactionalItems = allowedItems(transactionalNav);
  const managementItems = allowedItems(managementNav);

  const isActive = (item: NavItem) => {
    if (item.href === "/") return pathname === "/";
    if (item.href === "/inventory") {
      return (
        pathname === "/inventory" ||
        pathname === "/inventory/new" ||
        /^\/inventory\/[^/]+\/(edit|label)$/.test(pathname)
      );
    }
    const paths = [item.href, ...(item.relatedPaths || [])];
    return paths.some((path) => pathname === path || pathname.startsWith(path + "/"));
  };

  const renderItem = (item: NavItem, nested = false) => {
    const active = isActive(item);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg py-2.5 text-sm transition-colors",
          nested ? "pl-8 pr-3" : "px-3",
          active
            ? "bg-[var(--gold)]/15 text-[var(--gold-soft)]"
            : "text-white/65 hover:bg-white/5 hover:text-white"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {navLabel(language, item.labelKey)}
      </Link>
    );
  };
  const managementActive = managementItems.some(isActive);

  useEffect(() => {
    const activeItem = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!activeItem) return;
    const frame = window.requestAnimationFrame(() => {
      activeItem.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <aside className="no-print sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[var(--sidebar)] text-[var(--sidebar-fg)]">
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
      <nav ref={navRef} className="sidebar-nav min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 py-4">
        {reportingItems.map((item) => renderItem(item))}
        {transactionalItems.map((item) => renderItem(item))}
        {managementItems.length > 0 ? (
          <details className="group" open={managementActive}>
            <summary
              className={cn(
                "flex cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors [&::-webkit-details-marker]:hidden",
                managementActive
                  ? "bg-[var(--gold)]/10 text-[var(--gold-soft)]"
                  : "text-white/65 hover:bg-white/5 hover:text-white"
              )}
            >
              <BriefcaseBusiness className="h-4 w-4 shrink-0" />
              <span className="flex-1">Management</span>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-0.5 space-y-0.5 border-l border-white/10 pl-1">
              {managementItems.map((item) => renderItem(item, true))}
            </div>
          </details>
        ) : null}
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
