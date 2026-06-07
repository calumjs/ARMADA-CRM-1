"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Anchor,
  Building2,
  Compass,
  LayoutDashboard,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface HelmLink {
  href: string;
  label: string;
  /** The fleet vocabulary term, shown as a subtitle. */
  hint: string;
  icon: LucideIcon;
}

export const HELM_LINKS: HelmLink[] = [
  { href: "/", label: "Bridge", hint: "Dashboard", icon: LayoutDashboard },
  { href: "/ports", label: "Ports", hint: "Companies", icon: Building2 },
  { href: "/voyages", label: "Voyages", hint: "Deals", icon: Anchor },
  { href: "/chart", label: "Chart", hint: "Deal map", icon: Compass },
  { href: "/log", label: "Log", hint: "Activity", icon: ScrollText },
];

export function HelmNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="The Helm" className="flex flex-col gap-1 px-3 py-4">
      {HELM_LINKS.map(({ href, label, hint, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="flex flex-col leading-tight">
              <span>{label}</span>
              <span
                className={cn(
                  "text-[10px] uppercase tracking-wider",
                  active
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground/70",
                )}
              >
                {hint}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
