import { db } from "../lib/db";
async function main() {
  const rows = await db.$queryRawUnsafe("PRAGMA table_info(FacebookAccount)") as Array<Record<string, unknown>>;
  console.log(rows.map((r) => ({ name: String(r.name), type: String(r.type), notnull: String(r.notnull), dflt_value: r.dflt_value == null ? null : String(r.dflt_value) })));
}
main().finally(() => db.$disconnect());
