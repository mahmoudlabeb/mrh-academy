const apiURL = `${(process.env.API_UPSTREAM_URL || "http://localhost:4000").replace(/\/+$/, "")}/api/v1`;

async function waitForHealth(url: string, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(
    `API not reachable at ${url}/health — start the API (port 4000) or set API_UPSTREAM_URL.`,
  );
}

export default async function globalSetup() {
  await waitForHealth(apiURL);
  console.log(`E2E global setup: API healthy at ${apiURL}`);
}
