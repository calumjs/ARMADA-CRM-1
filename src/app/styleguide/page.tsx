"use client";

import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STAGE_META, VOYAGE_STAGES } from "@/lib/voyage";

const SWATCHES: { name: string; className: string; token: string }[] = [
  { name: "Navy", className: "bg-navy", token: "--navy" },
  { name: "Brass", className: "bg-brass", token: "--brass" },
  { name: "Parchment", className: "bg-parchment", token: "--parchment" },
  { name: "Primary", className: "bg-primary", token: "--primary" },
  { name: "Accent", className: "bg-accent", token: "--accent" },
  { name: "Muted", className: "bg-muted", token: "--muted" },
];

const SIGNALS: { name: string; className: string }[] = [
  { name: "Signal red", className: "bg-signal-red" },
  { name: "Signal yellow", className: "bg-signal-yellow" },
  { name: "Signal blue", className: "bg-signal-blue" },
  { name: "Signal green", className: "bg-signal-green" },
  { name: "Signal white", className: "bg-signal-white border" },
];

const TYPE_SCALE: { label: string; className: string }[] = [
  { label: "Display / 3xl", className: "font-display text-3xl font-bold" },
  { label: "Display / 2xl", className: "font-display text-2xl font-semibold" },
  { label: "Heading / xl", className: "text-xl font-semibold" },
  { label: "Body / base", className: "text-base" },
  { label: "Small / sm", className: "text-sm text-muted-foreground" },
  { label: "Mono / sm", className: "font-mono text-sm" },
];

const SIGNAL_BADGE = {
  blue: "signal-blue",
  yellow: "signal-yellow",
  green: "signal-green",
  red: "signal-red",
  white: "secondary",
} as const;

export default function StyleguidePage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="ARMADA Design System"
        subtitle="The nautical palette, type scale, and core components — light and dark."
      />

      {/* Palette */}
      <section>
        <h2 className="mb-4 font-display text-xl font-semibold">Palette</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {SWATCHES.map((s) => (
            <div key={s.name} className="space-y-2">
              <div className={`h-20 w-full rounded-lg border ${s.className}`} />
              <div className="text-sm font-medium">{s.name}</div>
              <code className="text-xs text-muted-foreground">{s.token}</code>
            </div>
          ))}
        </div>
        <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Signal flags
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {SIGNALS.map((s) => (
            <div key={s.name} className="space-y-2">
              <div className={`h-14 w-full rounded-lg ${s.className}`} />
              <div className="text-sm">{s.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Type scale */}
      <section>
        <h2 className="mb-4 font-display text-xl font-semibold">Type scale</h2>
        <Card>
          <CardContent className="space-y-4 pt-6">
            {TYPE_SCALE.map((t) => (
              <div
                key={t.label}
                className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between"
              >
                <span className={t.className}>Chart a steady course</span>
                <span className="text-xs text-muted-foreground">{t.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Components */}
      <section className="space-y-6">
        <h2 className="font-display text-xl font-semibold">Components</h2>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Buttons</CardTitle>
            <CardDescription>Variants and sizes.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button>Default</Button>
            <Button variant="brass">Brass</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Wreck it</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stage badges</CardTitle>
            <CardDescription>
              The signal-flag accents map to VoyageStage.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {VOYAGE_STAGES.map((stage) => {
              const meta = STAGE_META[stage];
              return (
                <Badge key={stage} variant={SIGNAL_BADGE[meta.accent]}>
                  {meta.label}
                </Badge>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Input</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Search the fleet…" />
              <Input type="email" placeholder="captain@example.com" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Avatar</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>AM</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback className="bg-brass text-brass-foreground">
                  JT
                </AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback className="bg-navy text-navy-foreground">
                  RC
                </AvatarFallback>
              </Avatar>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dialog</CardTitle>
            </CardHeader>
            <CardContent>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="brass">Hail the captain</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Signal sent</DialogTitle>
                    <DialogDescription>
                      A dialog rendered from the ARMADA design system.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="secondary">Belay</Button>
                    <Button>Confirm</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dropdown menu</CardTitle>
            </CardHeader>
            <CardContent>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Set a course</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Course</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Plot a voyage</DropdownMenuItem>
                  <DropdownMenuItem>Log an activity</DropdownMenuItem>
                  <DropdownMenuItem>Add a captain</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Table</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voyage</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Trade winds</TableCell>
                  <TableCell>
                    <Badge variant="signal-yellow">Underway</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    $48,000
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Northern run</TableCell>
                  <TableCell>
                    <Badge variant="signal-green">Anchored</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    $120,000
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
