// Idempotent seed — run twice = same state. Upsert on stable id/slug/key only.
// Usage: prisma db seed            (default domain = khang-guru)
//        prisma db seed -- --domain=dongy
// The canonical building logic lives in seedCore.ts (reused by the M10 reset action).
import { PrismaClient } from "@prisma/client";
import { seedCore } from "./seedCore";

const db = new PrismaClient();

// --- CLI arg parse ---
function parseDomain(): string {
  const arg = process.argv.find((a) => a.startsWith("--domain="));
  return arg ? arg.split("=")[1] : "khang-guru";
}

async function main() {
  const domain = parseDomain();
  console.log(`\nSeeding domain: ${domain}\n`);

  await seedCore(db, domain);

  // --- count table ---
  const counts = {
    UserProfile: await db.userProfile.count(),
    BrandDNA: await db.brandDNA.count(),
    Goal: await db.goal.count(),
    AppState: await db.appState.count(),
    ContentObjective: await db.contentObjective.count(),
    Framework: await db.framework.count(),
    ContentTemplate: await db.contentTemplate.count(),
    AIModelConfig: await db.aIModelConfig.count(),
    PromptTemplate: await db.promptTemplate.count(),
  };
  console.log("Row counts after seed:");
  console.table(counts);
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
