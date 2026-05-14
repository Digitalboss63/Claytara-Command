/**
 * scripts/seed.ts — Seed realistic project data
 * Run: npm run db:seed
 */

import db from "../server/db/index.js";
import { projects, projectNotes, systemHealthSnapshots } from "../shared/schema.js";

async function seed() {
  process.stdout.write("[seed] Seeding Claytara Command...\n");

  // Clear existing
  await db.delete(projectNotes);
  await db.delete(systemHealthSnapshots);
  await db.delete(projects);

  // ── Projects ────────────────────────────────────────────────────────────────
  const inserted = await db.insert(projects).values([
    {
      name: "The Vital Herbs",
      description: "Herbal health resource platform targeting Black American, American Indian, and Caribbean communities. Recurring subscription model with AI herb advisor.",
      status: "active",
      priority: "high",
      productionStage: "live",
      domain: "thevitalherbs.com",
      githubUrl: "https://github.com/Digitalboss63/green-thumb-coach",
      railwayUrl: "https://www.thevitalherbs.com",
      stripeConnected: true,
      clerkConnected: true,
      aiEnabled: true,
      notes: "Voice Advisor Phase 2 live. 104 herbs in catalog. Phase 3 (Twilio/ElevenLabs) ready to build.",
      blockers: null,
      lastDeployedAt: new Date("2026-05-14"),
    },
    {
      name: "Shopfu",
      description: "AI-powered Shopify store builder. Solves ugly stores and limited niche/category support. Holiday AI feature included.",
      status: "building",
      priority: "high",
      productionStage: "beta",
      domain: null,
      githubUrl: "https://github.com/Digitalboss63/Shopfu",
      railwayUrl: null,
      stripeConnected: false,
      clerkConnected: false,
      aiEnabled: true,
      notes: "Core store builder functional. AI product categorization needs tuning.",
      blockers: "Shopify API rate limits on bulk product import need mitigation strategy.",
      lastDeployedAt: new Date("2026-04-11"),
    },
    {
      name: "The Credit Signal Pro",
      description: "Consumer credit intelligence machine. 4-tier subscription: Trial / Essential / All Access / Enterprise.",
      status: "active",
      priority: "critical",
      productionStage: "live",
      domain: "creditsignalpro.com",
      githubUrl: "https://github.com/Digitalboss63/the-credit-sentinel",
      railwayUrl: "https://web-production-28ae1.up.railway.app",
      stripeConnected: true,
      clerkConnected: true,
      aiEnabled: true,
      notes: "Rebrand from Credit Sentinel complete. All 4 Stripe price IDs needed in Railway vars.",
      blockers: "STRIPE_PRICE_ID_ESSENTIAL, STRIPE_PRICE_ID_ALL_ACCESS, STRIPE_PRICE_ID_ENTERPRISE not yet set.",
      lastDeployedAt: new Date("2026-05-06"),
    },
    {
      name: "LeadGen Foundry",
      description: "AI website and lead generation system. Automated lead capture and nurturing pipeline.",
      status: "building",
      priority: "medium",
      productionStage: "prototype",
      domain: null,
      githubUrl: null,
      railwayUrl: null,
      stripeConnected: false,
      clerkConnected: false,
      aiEnabled: true,
      notes: "Architecture defined. Build not yet started.",
      blockers: "Waiting on Shopfu completion before full focus here.",
      lastDeployedAt: null,
    },
    {
      name: "Funds Finder AI",
      description: "AI-powered grant and funding discovery platform. Helps users find and apply for business grants.",
      status: "paused",
      priority: "low",
      productionStage: "idea",
      domain: null,
      githubUrl: null,
      railwayUrl: null,
      stripeConnected: false,
      clerkConnected: false,
      aiEnabled: true,
      notes: "Concept validated. On backlog pending bandwidth.",
      blockers: null,
      lastDeployedAt: null,
    },
    {
      name: "BOARDS OS",
      description: "Operational board management system. Project and task visibility layer.",
      status: "paused",
      priority: "low",
      productionStage: "idea",
      domain: null,
      githubUrl: null,
      railwayUrl: null,
      stripeConnected: false,
      clerkConnected: false,
      aiEnabled: false,
      notes: "Concept stage. Claytara Command may supersede or absorb this.",
      blockers: null,
      lastDeployedAt: null,
    },
  ]).returning();

  // ── Project Notes ────────────────────────────────────────────────────────────
  const vitalHerbs     = inserted.find(p => p.name === "The Vital Herbs")!;
  const creditSignal   = inserted.find(p => p.name === "The Credit Signal Pro")!;
  const shopfu         = inserted.find(p => p.name === "Shopfu")!;

  await db.insert(projectNotes).values([
    {
      projectId: vitalHerbs.id,
      title: "Voice Advisor Phase 2 Live",
      note: "Retrieval-grounded voice advisor deployed. Feature flag VOICE_ADVISOR_ENABLED=true set in Railway. All 9 verification tests passed. Admin stats endpoint live.",
      severity: "info",
    },
    {
      projectId: vitalHerbs.id,
      title: "APP_URL env var missing",
      note: "Railway health check shows missing: APP_URL. Not a blocker but health endpoint shows empty publicBaseUrl. Set APP_URL=https://www.thevitalherbs.com in Railway Variables.",
      severity: "warning",
    },
    {
      projectId: creditSignal.id,
      title: "Stripe Price IDs Missing",
      note: "Three Stripe price IDs not yet set in Railway: STRIPE_PRICE_ID_ESSENTIAL, STRIPE_PRICE_ID_ALL_ACCESS, STRIPE_PRICE_ID_ENTERPRISE. Subscription checkout will fail without these.",
      severity: "blocker",
    },
    {
      projectId: creditSignal.id,
      title: "Rebrand Complete",
      note: "Full rebrand from Credit Sentinel to The Credit Signal Pro complete. All UI updated. New 4-tier pricing model in place. Domain creditsignalpro.com registered.",
      severity: "info",
    },
    {
      projectId: shopfu.id,
      title: "API Rate Limit Risk",
      note: "Shopify bulk product import hits rate limits above ~50 products/min. Need exponential backoff + queue strategy before production launch.",
      severity: "warning",
    },
  ]);

  // ── Health Snapshots (initial unknowns) ──────────────────────────────────────
  await db.insert(systemHealthSnapshots).values([
    { service: "railway",  status: "unknown", statusText: "Not yet checked" },
    { service: "stripe",   status: "unknown", statusText: "Not yet checked" },
    { service: "clerk",    status: "unknown", statusText: "Not yet checked" },
    { service: "github",   status: "unknown", statusText: "Not yet checked" },
    { service: "ai",       status: "unknown", statusText: "Not yet checked" },
    { service: "domains",  status: "unknown", statusText: "Not yet checked" },
  ]);

  process.stdout.write(`[seed] Done. ${inserted.length} projects, notes, and health records seeded.\n`);
  process.exit(0);
}

seed().catch((e) => {
  process.stderr.write(`[seed] Error: ${String(e)}\n`);
  process.exit(1);
});
