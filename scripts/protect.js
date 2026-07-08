/**
 * Protection Script - Mr.H Academy
 * Builds the project and obfuscates output so client can run but not edit.
 * Run: npm run protect
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname.replace(/\\scripts$/, '').replace(/\/scripts$/, '');

function log(msg) { console.log('\x1b[36m[PROTECT]\x1b[0m', msg); }
function success(msg) { console.log('\x1b[32m[OK]\x1b[0m', msg); }

try {
  // 1. Install obfuscator
  log('Installing obfuscation tools...');
  execSync('npm install --save-dev javascript-obfuscator', { cwd: ROOT, stdio: 'pipe' });

  // 2. Build both apps
  log('Building API...');
  execSync('npx nest build', { cwd: path.join(ROOT, 'apps', 'api'), stdio: 'pipe' });
  success('API built.');

  log('Building Web...');
  execSync('npx next build', { cwd: path.join(ROOT, 'apps', 'web'), stdio: 'pipe' });
  success('Web built.');

  // 3. Obfuscate API output
  const apiDist = path.join(ROOT, 'apps', 'api', 'dist');
  if (fs.existsSync(apiDist)) {
    log('Obfuscating API code...');
    const jsFiles = walkSync(apiDist, '.js');
    for (const file of jsFiles) {
      try {
        execSync(`npx javascript-obfuscator "${file}" --output "${file}" --compact true --control-flow-flattening true --dead-code-injection true --string-array true --string-array-encoding base64 --string-array-threshold 0.8 --self-defending true`, { stdio: 'pipe' });
      } catch (e) { /* skip errors for individual files */ }
    }
    // Remove source maps
    removeFiles(apiDist, '.js.map');
    removeFiles(apiDist, '.d.ts.map');
    success('API code obfuscated.');
  }

  // 4. Obfuscate Web output
  const webNext = path.join(ROOT, 'apps', 'web', '.next');
  if (fs.existsSync(webNext)) {
    log('Obfuscating Web output...');
    const webJsFiles = walkSync(webNext, '.js');
    for (const file of webJsFiles) {
      try {
        execSync(`npx javascript-obfuscator "${file}" --output "${file}" --compact true --control-flow-flattening true --dead-code-injection true --string-array true --string-array-encoding base64 --string-array-threshold 0.6 --self-defending true`, { stdio: 'pipe' });
      } catch (e) { /* skip */ }
    }
    removeFiles(webNext, '.js.map');
    success('Web code obfuscated.');
  }

  console.log('\n\x1b[33m=== Protection Complete! ===\x1b[0m');
  console.log('\x1b[32mClient can run: npm run client-start\x1b[0m');
  console.log('\x1b[32mSource code is protected and cannot be easily modified.\x1b[0m');
  console.log('\x1b[32mTo update: developer modifies source, runs npm run protect, delivers again.\x1b[0m');
} catch (err) {
  console.error('\x1b[31mProtection failed:\x1b[0m', err.message);
  process.exit(1);
}

// Helper: walk directory recursively for files with extension
function walkSync(dir, ext) {
  const results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...walkSync(fullPath, ext));
      } else if (fullPath.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch (e) { /* skip permission errors */ }
  return results;
}

// Helper: remove all files with extension recursively
function removeFiles(dir, ext) {
  const files = walkSync(dir, ext);
  for (const file of files) {
    try { fs.unlinkSync(file); } catch (e) { /* skip */ }
  }
}
