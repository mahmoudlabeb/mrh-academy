import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");
const playwrightCli = require.resolve("@playwright/test/cli");
const baseUrl = "http://127.0.0.1:3100";

function waitForExit(child) {
  return new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

async function waitForServer(attempts = 90) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The production server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Safe browser server did not become ready at ${baseUrl}`);
}

const server = spawn(
  process.execPath,
  [nextCli, "start", "--hostname", "127.0.0.1", "--port", "3100"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      API_UPSTREAM_URL: "http://127.0.0.1:9",
    },
    stdio: "inherit",
  },
);

let exitCode = 1;
try {
  await waitForServer();
  const test = spawn(
    process.execPath,
    [playwrightCli, "test", "--config=playwright.safe.config.ts"],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    },
  );
  const result = await waitForExit(test);
  exitCode = result.code ?? 1;
} finally {
  if (server.exitCode === null) {
    server.kill();
    const forcedStop = setTimeout(() => {
      if (server.exitCode === null) server.kill("SIGKILL");
    }, 5_000);
    forcedStop.unref();
    await Promise.race([
      waitForExit(server),
      new Promise((resolve) => setTimeout(resolve, 6_000)),
    ]);
  }
}

process.exitCode = exitCode;
