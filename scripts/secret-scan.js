const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const quiet = process.argv.includes('--quiet');

const patterns = [
  { label: 'Postgres URL hardcoded', regex: /postgresql?:\/\/[^\s"'`]+/, ignoreExample: true },
  { label: 'Stripe live key', regex: /sk_live_[0-9a-zA-Z]+/ },
  { label: 'Stripe webhook secret', regex: /whsec_[0-9a-zA-Z]+/ },
  { label: 'Metered API key hardcoded', regex: /metered[_\s]?api[_\s]?key\s*[:=]\s*['"][^\s'"]{10,}['"]/i },
  { label: 'TURN credential hardcoded', regex: /turn_credential\s*[:=]\s*['"][^\s'"]{4,}['"]/i },
  { label: 'SMTP password hardcoded', regex: /SMTP_PASS\s*[:=]\s*['"][^\s'"]{4,}['"]/ },
  { label: 'JWT secret hardcoded (not placeholder)', regex: /JWT_SECRET\s*[:=]\s*['"](?!change_me)[a-f0-9]{16,}['"]/ },
  { label: 'Redis URL with embedded password', regex: /redis:\/\/[^@\s]+@[^\s"'`]+/ },
  { label: 'Google service account key inline', regex: /google_service_account_private_key\s*[:=]\s*['"]-----BEGIN/i },
  { label: 'Upstash token inline', regex: /UPSTASH_REDIS_REST_TOKEN\s*[:=]\s*['"][^\s'"]+/ },
];

function getTrackedFiles() {
  const out = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' });
  return out.trim().split('\n').filter(Boolean);
}

function getUntrackedEnv() {
  const out = execSync('git ls-files --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' });
  return out.trim().split('\n').filter(Boolean).filter(f => /\.env/.test(f));
}

const excludeDirs = new Set(['node_modules', '.next', 'dist', '.git', '.cache']);
function shouldSkip(file) {
  return file.split(/[\\/]/).some(part => excludeDirs.has(part)) || /pnpm-lock/.test(file);
}

const files = [...new Set([...getTrackedFiles(), ...getUntrackedEnv()])].filter(f => !shouldSkip(f));

let foundIssues = 0;

for (const entry of patterns) {
  const hits = [];
  for (const f of files) {
    const fullPath = path.join(ROOT, f);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (entry.regex.test(content)) {
        if (entry.ignoreExample && (f === '.env.example' || f.endsWith('.env.example'))) continue;
        if (f.includes('.env.example') && /change_me|placeholder|your_/i.test(content)) continue;
        hits.push(f);
      }
    } catch { /* skip unreadable */ }
  }
  if (hits.length > 0) {
    foundIssues++;
    if (!quiet) {
      console.log(`\x1b[33m[WARN] ${entry.label}:\x1b[0m`);
      hits.forEach(h => console.log(`       \x1b[90m${h}\x1b[0m`));
    }
  } else if (!quiet) {
    console.log(`\x1b[32m[OK]   ${entry.label}\x1b[0m`);
  }
}

if (foundIssues === 0) {
  if (!quiet) console.log(`\n\x1b[32m[PASS] No secrets detected in working tree.\x1b[0m`);
  process.exit(0);
} else {
  console.log(`\n\x1b[33m[FAIL] ${foundIssues} pattern(s) matched. Review flagged files.\x1b[0m`);
  process.exit(1);
}
