"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Palette, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CommandPalette, openHelm } from "@/components/command-palette";
import { HelmNav } from "@/components/helm-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        {/* Mobile: open The Helm in a dialog */}
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open The Helm navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="left-0 top-0 h-full max-w-[16rem] translate-x-0 translate-y-0 rounded-none border-r p-0">
            <DialogTitle className="px-5 pt-5">
              <Wordmark />
            </DialogTitle>
            <HelmNav />
          </DialogContent>
        </Dialog>

        <Link href="/" className="flex items-center">
          <Wordmark />
        </Link>

        <div className="ml-auto flex items-center gap-1">
          {/* The Helm: ⌘K command palette trigger. */}
          <button
            type="button"
            onClick={() => openHelm()}
            aria-label="Open The Helm command palette"
            aria-keyshortcuts="Meta+K Control+K"
            className="hidden items-center gap-2 rounded-md border border-input bg-background/60 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground sm:flex"
          >
            <Search className="h-4 w-4" />
            <span>Search the fleet…</span>
            <kbd className="ml-2 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium tracking-wider text-muted-foreground">
              ⌘K
            </kbd>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            aria-label="Open The Helm command palette"
            onClick={() => openHelm()}
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label="Styleguide">
            <Link href="/styleguide">
              <Palette className="h-5 w-5" />
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* The Helm command palette — registered globally, available from any page. */}
      <CommandPalette />

      <div className="flex flex-1">
        {/* Desktop nav rail: The Helm */}
        <aside className="hidden w-60 shrink-0 border-r bg-card/40 md:block">
          <div className="sticky top-16">
            <p className="px-6 pt-5 font-display text-xs font-bold uppercase tracking-[0.2em] text-brass">
              The Helm
            </p>
            <HelmNav />
          </div>
        </aside>

        {/* Responsive content area */}
        <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
