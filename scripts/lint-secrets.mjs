import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative, sep } from 'path';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env') });

const SECRET_STRINGS = [
  ['TELEGRAM_BOT_TOKEN', process.env.TELEGRAM_BOT_TOKEN],
  ['ADMIN_PASSWORD', process.env.ADMIN_PASSWORD],
  ['SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY],
].filter(([, v]) => v && String(v).length > 3);

const SCAN_DIRS = ['js', '.'];
const EXTS = ['js', 'html', 'ts', 'tsx', 'jsx', 'mjs', 'cjs'];
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', '.netlify', 'supabase' + sep + 'migrations', 'netlify'];

function walk(dir) {
  let results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (EXCLUDE_DIRS.includes(e.name)) continue;
    if (e.isDirectory()) results = results.concat(walk(full));
    else if (e.isFile()) results.push(full);
  }
  return results;
}

function main() {
  let fails = 0;

  const files = [];
  for (const d of SCAN_DIRS) {
    const full = join(projectRoot, d);
    if (existsSync(full)) files.push(...walk(full));
  }

  const filtered = files.filter((f) => {
    const ext = f.split('.').pop().toLowerCase();
    return EXTS.includes(ext);
  });

  for (const f of filtered) {
    const rel = relative(projectRoot, f);
    if (rel.startsWith('.env')) continue;
    if (rel.includes('env.generated.js')) continue;
    const content = readFileSync(f, 'utf8');
    for (const [name, secret] of SECRET_STRINGS) {
      if (content.includes(secret)) {
        console.error(`❌ FAIL: ${rel} contains secret: ${name}`);
        fails++;
      }
    }
  }

  if (fails === 0) {
    console.log('✅ PASS: No secrets found in front-end files.');
    process.exit(0);
  } else {
    console.error(`❌ ${fails} secret leak(s) detected. Fix before building.`);
    process.exit(1);
  }
}

main();
