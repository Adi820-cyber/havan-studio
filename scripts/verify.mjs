/**
 * Static verification for the React source tree.
 *
 * `npm run build` is the real check and you should still run it. This exists
 * because a bundler needs platform-native binaries (rollup, esbuild) and an
 * install that matches the machine it runs on, which is not always available —
 * whereas @babel/parser is pure JavaScript and ships with the React plugin
 * already in this project.
 *
 * What it catches, which is most of what a broken build actually is:
 *
 *   1. Syntax errors in any .js / .jsx file.
 *   2. Relative imports that point at a file which does not exist.
 *   3. Named imports of a binding the target module does not export — the
 *      "renamed the export, forgot one importer" failure.
 *   4. Icon names that are not in the installed lucide-react. The package drops
 *      and renames icons between versions (brand icons are gone in v1), so a
 *      plausible-looking name is not enough.
 *   5. Identifiers referenced but never bound — the "used the state variable
 *      you renamed" failure, which a bundler would only surface at runtime.
 *
 * Run: node scripts/verify.mjs
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const problems = [];
const fail = (file, msg) => problems.push(`${file.replace(ROOT + '/', '')}: ${msg}`);

/* ────────────────── collect files ────────────────── */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (['.js', '.jsx'].includes(extname(entry))) out.push(full);
  }
  return out;
}

const files = walk(SRC);

/* ────────────────── parse ────────────────── */

const asts = new Map();

for (const file of files) {
  const code = readFileSync(file, 'utf8');
  try {
    asts.set(
      file,
      parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator']
      })
    );
  } catch (err) {
    fail(file, `syntax error — ${err.message}`);
  }
}

/* ────────────────── exports per module ────────────────── */

const exportsOf = new Map();

for (const [file, ast] of asts) {
  const names = new Set();
  for (const node of ast.program.body) {
    if (node.type === 'ExportDefaultDeclaration') names.add('default');
    if (node.type === 'ExportNamedDeclaration') {
      for (const s of node.specifiers || []) names.add(s.exported.name);
      const d = node.declaration;
      if (d) {
        if (d.type === 'VariableDeclaration') {
          for (const decl of d.declarations) {
            if (decl.id.type === 'Identifier') names.add(decl.id.name);
          }
        } else if (d.id) {
          names.add(d.id.name);
        }
      }
    }
  }
  exportsOf.set(file, names);
}

/* ────────────────── resolve relative imports ────────────────── */

function resolveImport(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  const candidates = [base, `${base}.js`, `${base}.jsx`, join(base, 'index.js'), join(base, 'index.jsx')];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) || null;
}

/* ────────────────── lucide surface ────────────────── */

const lucideDts = join(ROOT, 'node_modules', 'lucide-react', 'dist', 'lucide-react.d.ts');
const lucideNames = existsSync(lucideDts)
  ? new Set(readFileSync(lucideDts, 'utf8').match(/\b[A-Z][A-Za-z0-9]*\b/g) || [])
  : null;

/* ────────────────── import checks ────────────────── */

for (const [file, ast] of asts) {
  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue;
    const spec = node.source.value;
    const named = node.specifiers
      .filter((s) => s.type === 'ImportSpecifier')
      .map((s) => s.imported.name);

    if (spec.startsWith('.')) {
      const target = resolveImport(file, spec);
      if (!target) {
        fail(file, `imports "${spec}", which does not resolve to a file`);
        continue;
      }
      const available = exportsOf.get(target);
      if (!available) continue;
      const wantsDefault = node.specifiers.some((s) => s.type === 'ImportDefaultSpecifier');
      if (wantsDefault && !available.has('default')) {
        fail(file, `imports a default from "${spec}", which has no default export`);
      }
      for (const n of named) {
        if (!available.has(n)) fail(file, `imports { ${n} } from "${spec}", which does not export it`);
      }
    } else {
      const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (!existsSync(join(ROOT, 'node_modules', pkg))) {
        fail(file, `imports "${pkg}", which is not installed`);
        continue;
      }
      if (pkg === 'lucide-react' && lucideNames) {
        for (const n of named) {
          if (!lucideNames.has(n)) {
            fail(file, `imports { ${n} } from lucide-react, which has no such icon in the installed version`);
          }
        }
      }
    }
  }
}

/* ────────────────── unbound identifiers ────────────────── */

// Anything legitimately global in a browser + the JSX runtime. Kept explicit so
// a typo cannot pass by resembling a global.
const GLOBALS = new Set([
  'window', 'document', 'navigator', 'console', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'fetch', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'Image',
  'FormData', 'Intl', 'JSON', 'Math', 'Date', 'Object', 'Array', 'String',
  'Number', 'Boolean', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Error',
  'RegExp', 'Symbol', 'globalThis', 'localStorage', 'sessionStorage', 'crypto',
  'AudioContext', 'webkitAudioContext', 'IntersectionObserver', 'ResizeObserver',
  'MutationObserver', 'AbortController', 'CustomEvent', 'Event', 'HTMLElement',
  'performance', 'structuredClone', 'queueMicrotask', 'process', 'import',
  'undefined', 'NaN', 'Infinity', 'atob', 'btoa', 'alert', 'confirm', 'prompt',
  'getComputedStyle', 'matchMedia', 'React', 'encodeURIComponent',
  'decodeURIComponent', 'encodeURI', 'decodeURI', 'parseFloat', 'parseInt',
  'isNaN', 'isFinite'
]);

for (const [file, ast] of asts) {
  traverse(ast, {
    Program(path) {
      for (const [name, binding] of Object.entries(path.scope.globals || {})) {
        void binding;
        if (!GLOBALS.has(name)) {
          fail(file, `references "${name}", which is never imported or declared`);
        }
      }
    }
  });
}

/* ────────────────── report ────────────────── */

const unique = [...new Set(problems)];

if (unique.length) {
  console.error(`\n✗ ${unique.length} problem${unique.length === 1 ? '' : 's'}:\n`);
  for (const p of unique) console.error(`  ${p}`);
  console.error('');
  process.exit(1);
}

console.log(`✓ ${asts.size} files parsed, imports and identifiers resolve.`);
