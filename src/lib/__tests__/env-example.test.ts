import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Guards against the exact drift that let EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
// go undocumented in .env.example for a while: a var referenced in source
// but missing from the template a new contributor copies from would only
// surface as a confusing runtime failure, not a loud error. Deliberately
// does NOT compare against .env.local — that file is gitignored and won't
// exist in CI, so this only checks the one thing that's actually checked
// into the repo and read by everyone: source usage vs. the template.
const ROOT = join(__dirname, '../../..');

function findSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('backup-')) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      findSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function envVarsUsedInSource(): Set<string> {
  const used = new Set<string>();
  for (const file of findSourceFiles(join(ROOT, 'src'))) {
    const content = readFileSync(file, 'utf8');
    for (const match of content.matchAll(/process\.env\.(EXPO_PUBLIC_[A-Z0-9_]+)/g)) {
      used.add(match[1]);
    }
  }
  return used;
}

function envVarsDeclaredIn(fileName: string): Set<string> {
  const content = readFileSync(join(ROOT, fileName), 'utf8');
  const declared = new Set<string>();
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (match) declared.add(match[1]);
  }
  return declared;
}

describe('.env.example', () => {
  it('declares every EXPO_PUBLIC_* variable actually read from process.env in src/', () => {
    const used = envVarsUsedInSource();
    const declared = envVarsDeclaredIn('.env.example');
    const missing = [...used].filter((name) => !declared.has(name));
    expect(missing).toEqual([]);
  });
});
