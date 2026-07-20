import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type E2ERole = "admin" | "student" | "tutor";

export type BrowserCookieFixture = {
  name: string;
  value: string;
  url: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict";
};

export type E2ERoleFixture = {
  email: string;
  password: string;
  homePath: string;
  cookies: BrowserCookieFixture[];
};

export type E2EFixtureFile = {
  runId: string;
  roles: Record<E2ERole, E2ERoleFixture>;
};

export const fixtureFilePath = resolve(
  process.cwd(),
  "test-results",
  "e2e-auth.json",
);

export async function readE2EFixtures(): Promise<E2EFixtureFile> {
  return JSON.parse(await readFile(fixtureFilePath, "utf8")) as E2EFixtureFile;
}
