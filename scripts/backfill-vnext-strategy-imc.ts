import { db } from "../lib/db";
import { ensureStructuredStrategyProjection } from "../lib/piltover/vnext/strategy-service";
import { ensureImcPlanFromStrategy } from "../lib/piltover/vnext/imc-service";

async function main() {
  const versions = await db.strategyVersion.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  let structured = 0;
  let imc = 0;
  for (const version of versions) {
    await ensureStructuredStrategyProjection(db, version.id);
    structured += 1;
    await ensureImcPlanFromStrategy(db, version.id);
    imc += 1;
  }

  console.log(JSON.stringify({
    ok: true,
    strategyVersions: versions.length,
    structured,
    imc,
  }, null, 2));
}

main().finally(() => db.$disconnect());
