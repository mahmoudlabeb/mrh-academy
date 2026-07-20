import { unlink } from "node:fs/promises";
import { Client } from "pg";
import { fixtureFilePath, readE2EFixtures } from "./helpers/fixtures";

export default async function globalTeardown() {
  let fixtures;
  try {
    fixtures = await readE2EFixtures();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error("DATABASE_URL is required for cleanup.");

  const databaseName = new URL(connectionString).pathname.slice(1);
  if (!/(^|[_-])(e2e|test)([_-]|$)/i.test(databaseName)) {
    throw new Error(`Refusing to clean fixtures from ${databaseName}.`);
  }

  const client = new Client({
    connectionString,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? {
            rejectUnauthorized:
              process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
          }
        : false,
  });
  await client.connect();
  try {
    await client.query(`DELETE FROM users WHERE email LIKE $1`, [
      `playwright-${fixtures.runId}-%@mrh-academy.example`,
    ]);
  } finally {
    await client.end();
    await unlink(fixtureFilePath).catch(() => undefined);
  }
}
