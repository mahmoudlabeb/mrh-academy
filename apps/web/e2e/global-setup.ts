import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Client } from "pg";
import {
  type BrowserCookieFixture,
  type E2EFixtureFile,
  type E2ERole,
  fixtureFilePath,
} from "./helpers/fixtures";

const apiURL = `${(process.env.API_UPSTREAM_URL || "http://localhost:4000").replace(/\/+$/, "")}/api/v1`;
const baseURL = (process.env.BASE_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);
const origin = new URL(baseURL).origin;

function databaseConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to provision browser E2E users.");
  }

  const databaseName = new URL(connectionString).pathname.slice(1);
  if (!/(^|[_-])(e2e|test)([_-]|$)/i.test(databaseName)) {
    throw new Error(
      `Browser E2E fixtures require a disposable test database; received ${databaseName}.`,
    );
  }

  return {
    connectionString,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? {
            rejectUnauthorized:
              process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
          }
        : false,
  };
}

async function waitForHealth(url: string, attempts = 30) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(`${url}/health/live`);
      if (response.ok) return;
    } catch {
      // The API may still be starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2000));
  }
  throw new Error(
    `API not reachable at ${url}/health/live — start the API or set API_UPSTREAM_URL.`,
  );
}

async function verifyWebApplication() {
  const response = await fetch(baseURL);
  const html = await response.text();
  if (!response.ok || !html.includes("Mr.H Academy")) {
    throw new Error(
      `BASE_URL does not serve MRH Academy: ${baseURL}. Use an unused port or stop the conflicting server.`,
    );
  }
}

function cookieValue(response: Response, name: string): string {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies = headers.getSetCookie?.() ?? [
    headers.get("set-cookie") ?? "",
  ];
  const match = new RegExp(`(?:^|[,;]\\s*)${name}=([^;,\\s]+)`).exec(
    setCookies.join(","),
  );
  if (!match) throw new Error(`API did not return the ${name} cookie.`);
  return match[1];
}

async function csrfToken(): Promise<string> {
  const response = await fetch(`${apiURL}/auth/csrf`, {
    headers: { Origin: origin },
  });
  if (!response.ok) {
    throw new Error(
      `Unable to bootstrap CSRF protection (${response.status}).`,
    );
  }
  return cookieValue(response, "mrh_csrf");
}

async function postJson(path: string, token: string, body: object) {
  const response = await fetch(`${apiURL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `mrh_csrf=${token}`,
      Origin: origin,
      "X-CSRF-Token": token,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `${path} failed (${response.status}): ${await response.text()}`,
    );
  }
  return response;
}

async function registerUser(
  role: E2ERole,
  email: string,
  password: string,
  token: string,
) {
  await postJson("/auth/register", token, {
    email,
    password,
    firstName: "Browser",
    lastName: role[0].toUpperCase() + role.slice(1),
    role: role === "tutor" ? "tutor" : "student",
  });
}

async function loginUser(
  email: string,
  password: string,
  token: string,
): Promise<BrowserCookieFixture[]> {
  const response = await postJson("/auth/login", token, { email, password });
  const secure = new URL(baseURL).protocol === "https:";
  const cookie = (
    name: string,
    value: string,
    httpOnly: boolean,
  ): BrowserCookieFixture => ({
    name,
    value,
    url: baseURL,
    httpOnly,
    secure,
    sameSite: "Strict",
  });

  return [
    cookie("mrh_token", cookieValue(response, "mrh_token"), true),
    cookie("mrh_refresh", cookieValue(response, "mrh_refresh"), true),
    cookie("mrh_csrf", token, false),
  ];
}

export default async function globalSetup() {
  await waitForHealth(apiURL);
  await verifyWebApplication();
  const client = new Client(databaseConfig());
  await client.connect();

  const runId = randomUUID();
  const password = `E2E-${randomBytes(24).toString("base64url")}`;
  const roles = ["admin", "student", "tutor"] as const;
  const emails = Object.fromEntries(
    roles.map((role) => [
      role,
      `playwright-${runId}-${role}@mrh-academy.example`,
    ]),
  ) as Record<E2ERole, string>;

  try {
    const token = await csrfToken();
    for (const role of roles) {
      await registerUser(role, emails[role], password, token);
    }

    await client.query(
      `UPDATE users SET is_verified = true WHERE email = ANY($1::text[])`,
      [Object.values(emails)],
    );
    await client.query(`UPDATE users SET role = 'admin' WHERE email = $1`, [
      emails.admin,
    ]);
    await client.query(
      `DELETE FROM student_profiles WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
      [emails.admin],
    );
    await client.query(
      `UPDATE tutor_profiles SET status = 'approved' WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
      [emails.tutor],
    );
    await client.query(
      `INSERT INTO settings (key, value) VALUES ('maintenance_mode', 'false') ON CONFLICT (key) DO UPDATE SET value = 'false'`,
    );

    const fixtures: E2EFixtureFile = {
      runId,
      roles: {
        admin: {
          email: emails.admin,
          password,
          homePath: "/admin",
          cookies: await loginUser(emails.admin, password, token),
        },
        student: {
          email: emails.student,
          password,
          homePath: "/student",
          cookies: await loginUser(emails.student, password, token),
        },
        tutor: {
          email: emails.tutor,
          password,
          homePath: "/tutor",
          cookies: await loginUser(emails.tutor, password, token),
        },
      },
    };

    await mkdir(dirname(fixtureFilePath), { recursive: true });
    await writeFile(fixtureFilePath, JSON.stringify(fixtures), {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch (error) {
    await client.query(`DELETE FROM users WHERE email LIKE $1`, [
      `playwright-${runId}-%@mrh-academy.example`,
    ]);
    throw error;
  } finally {
    await client.end();
  }
}
