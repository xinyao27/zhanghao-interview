import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, client } from "./index";

async function main() {
  console.log("Migration started...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migration completed!");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
