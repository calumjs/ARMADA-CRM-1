import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient, type VoyageStage } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

const STAGES: VoyageStage[] = [
  "CHARTED",
  "PROVISIONED",
  "UNDERWAY",
  "BOARDING",
  "ANCHORED",
  "WRECKED",
];

const PORTS = [
  { name: "Meridian Shipping Co.", industry: "Logistics", location: "Bristol" },
  { name: "Halcyon Freight", industry: "Logistics", location: "Rotterdam" },
  { name: "Saltworks Trading", industry: "Commodities", location: "Lisbon" },
  { name: "Northwind Marine", industry: "Manufacturing", location: "Bergen" },
  { name: "Coral Bay Holdings", industry: "Hospitality", location: "Valletta" },
  { name: "Tidewater Logistics", industry: "Logistics", location: "Hamburg" },
  { name: "Beacon & Reed", industry: "Insurance", location: "London" },
  { name: "Sextant Analytics", industry: "Software", location: "Dublin" },
];

const FIRST_NAMES = [
  "Ada",
  "Rourke",
  "Mira",
  "Cassian",
  "Elif",
  "Tomas",
  "Greta",
  "Idris",
  "Noor",
  "Wren",
  "Soren",
  "Beatrix",
  "Hugo",
  "Lena",
  "Marisol",
  "Dario",
  "Priya",
  "Knut",
  "Ophelia",
  "Magnus",
];

const LAST_NAMES = [
  "Vance",
  "Okafor",
  "Lindqvist",
  "Moreau",
  "Demir",
  "Halloran",
  "Bauer",
  "Fontaine",
  "Reyes",
  "Castellan",
  "Nakamura",
  "Bello",
  "Sørensen",
  "Ashworth",
  "Vargas",
  "Petrov",
  "Larsen",
  "Mensah",
  "Quigley",
  "Roux",
];

const TITLES = [
  "Procurement Lead",
  "Operations Director",
  "Founder",
  "Head of Logistics",
  "CFO",
  "Account Manager",
  "Fleet Coordinator",
];

const VOYAGE_NAMES = [
  "Spice Route Renewal",
  "Cold Chain Expansion",
  "Harbour Modernisation",
  "Annual Freight Contract",
  "Fleet Insurance Bundle",
  "Analytics Platform Rollout",
  "Bulk Cargo Agreement",
  "Port Automation Pilot",
  "Multi-year Charter",
  "Warehouse Integration",
  "Customs Software Deal",
  "Seasonal Capacity Buy",
  "Maintenance Retainer",
  "Trans-Atlantic Lane",
  "Coastal Distribution Deal",
];

const ACTIVITY_TYPES = ["NOTE", "CALL", "EMAIL", "MEETING", "TASK"] as const;
const ACTIVITY_SUBJECTS = [
  "Intro call with the captain",
  "Sent provisioning proposal",
  "Followed up on terms",
  "Logged contract redlines",
  "Quarterly review meeting",
  "Left voicemail",
  "Shared pricing sheet",
  "Scheduled site visit",
];

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("Clearing existing fleet data…");
  await prisma.activity.deleteMany();
  await prisma.voyage.deleteMany();
  await prisma.captain.deleteMany();
  await prisma.port.deleteMany();

  console.log("Seeding ports…");
  const ports = [];
  for (const p of PORTS) {
    ports.push(
      await prisma.port.create({
        data: {
          name: p.name,
          industry: p.industry,
          location: p.location,
          website: `https://${p.name
            .toLowerCase()
            .replace(/[^a-z]+/g, "")}.example.com`,
          notes: `Home waters: ${p.location}.`,
        },
      }),
    );
  }

  console.log("Seeding captains…");
  const captains = [];
  for (let i = 0; i < 20; i++) {
    const first = pick(FIRST_NAMES, i);
    const last = pick(LAST_NAMES, i);
    const port = pick(ports, i);
    captains.push(
      await prisma.captain.create({
        data: {
          firstName: first,
          lastName: last,
          email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
          phone: `+44 7700 9000${(i + 10).toString().padStart(2, "0")}`,
          title: pick(TITLES, i),
          portId: port.id,
        },
      }),
    );
  }

  console.log("Seeding voyages across every stage…");
  const voyages = [];
  for (let i = 0; i < VOYAGE_NAMES.length; i++) {
    // Round-robin through stages so all six are represented.
    const stage = pick(STAGES, i);
    const port = pick(ports, i);
    const captain = pick(captains, i);
    const closed = stage === "ANCHORED" || stage === "WRECKED";
    voyages.push(
      await prisma.voyage.create({
        data: {
          name: VOYAGE_NAMES[i],
          stage,
          value: 15000 + ((i * 9173) % 180000),
          probability: closed
            ? stage === "ANCHORED"
              ? 100
              : 0
            : 20 + ((i * 13) % 70),
          expectedClose: closed ? null : daysFromNow(7 + i * 5),
          closedAt: closed ? daysFromNow(-(i + 1) * 3) : null,
          portId: port.id,
          captainId: captain.id,
        },
      }),
    );
  }

  console.log("Seeding activities…");
  let activityCount = 0;
  for (let i = 0; i < voyages.length; i++) {
    const voyage = voyages[i];
    const n = 2 + (i % 3); // 2-4 activities per voyage
    for (let j = 0; j < n; j++) {
      const idx = i + j;
      const type = pick(ACTIVITY_TYPES, idx);
      await prisma.activity.create({
        data: {
          type,
          subject: pick(ACTIVITY_SUBJECTS, idx),
          body: `Logged against ${voyage.name}.`,
          occurredAt: daysFromNow(-(idx % 30)),
          done: type === "TASK" ? idx % 2 === 0 : true,
          voyageId: voyage.id,
          portId: voyage.portId,
          captainId: voyage.captainId,
        },
      });
      activityCount++;
    }
  }

  console.log(
    `Seeded ${ports.length} ports, ${captains.length} captains, ${voyages.length} voyages, ${activityCount} activities.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
