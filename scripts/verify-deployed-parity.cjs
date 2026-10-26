// Compare public deployment artifacts without executing downloaded JavaScript.
// Usage: npm run build && node scripts/verify-deployed-parity.cjs
// Offline: add --js <downloaded bundle> --css <downloaded stylesheet>.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const postcss = require('postcss');

const base = 'https://melorank.netlify.app/';
const args = process.argv.slice(2);
const option = name => args[args.indexOf(name) + 1];
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function functions(source) {
  return source.statements.flatMap(statement => {
    if (ts.isFunctionDeclaration(statement)) return [statement];
    if (!ts.isVariableStatement(statement)) return [];
    return statement.declarationList.declarations
      .map(declaration => declaration.initializer)
      .filter(node => node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node)));
  });
}

// Minifiers rename local bindings. Keep syntax, property names, literals and
// operators while assigning bindings stable names in order of first occurrence.
const checkers = new WeakMap();
const globals = new Set(['Object', 'Array', 'Math', 'Date', 'Promise', 'Uint8Array', 'TextEncoder', 'Image', 'FileReader', 'Blob', 'fetch', 'atob', 'URL', 'navigator', 'document', 'window', 'console', 'localStorage', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'parseFloat', 'parseInt', 'Number', 'String', 'Error']);
function syntax(node) {
  const source = node.getSourceFile();
  if (!checkers.has(source)) {
    const options = { allowJs: true, noLib: true, noResolve: true };
    const host = ts.createCompilerHost(options);
    host.getSourceFile = file => file === source.fileName ? source : undefined;
    const program = ts.createProgram([source.fileName], options, host);
    checkers.set(source, program.getTypeChecker());
  }
  const checker = checkers.get(source);
  const identifiers = new Map();
  const result = [];
  function visit(current) {
    if (ts.isIdentifier(current)) {
      const parent = current.parent;
      const property = (ts.isPropertyAccessExpression(parent) && parent.name === current)
        || (ts.isPropertyAssignment(parent) && parent.name === current)
        || (ts.isBindingElement(parent) && parent.propertyName === current);
      if (property) result.push(`property:${current.text}`);
      else if (globals.has(current.text)) result.push(`global:${current.text}`);
      else {
        const symbol = checker.getSymbolAtLocation(current);
        // Reused minified names in different nested scopes are separate bindings.
        const binding = symbol || `global:${current.text}`;
        if (!identifiers.has(binding)) identifiers.set(binding, identifiers.size);
        result.push(symbol ? `binding:${identifiers.get(binding)}` : binding);
      }
      return;
    }
    if (ts.isStringLiteral(current) || ts.isNumericLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
      result.push(`${ts.SyntaxKind[current.kind]}:${current.text}`);
      return;
    }
    result.push(ts.SyntaxKind[current.kind]);
    ts.forEachChild(current, visit);
  }
  visit(node.body || node);
  return result;
}

function literal(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => {
    if (!ts.isPropertyAssignment(property)) throw new Error('Not a literal property');
    return [property.name.text, literal(property.initializer)];
  }));
  throw new Error('Not literal data');
}

function cssRules(css) {
  const result = new Map();
  postcss.parse(css).walkRules(rule => {
    let context = '';
    for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
      if (parent.type === 'atrule') context = `@${parent.name} ${parent.params}|${context}`;
    }
    const key = context + rule.selector;
    const declarations = result.get(key) || {};
    for (const declaration of rule.nodes) {
      if (declaration.type === 'decl') declarations[declaration.prop] = declaration.value + (declaration.important ? '!important' : '');
    }
    result.set(key, declarations);
  });
  return result;
}

function cssAtWidth(css, width) {
  const result = new Map();
  postcss.parse(css).walkRules(rule => {
    for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
      if (parent.type !== 'atrule') continue;
      if (parent.name === 'layer') return;
      if (parent.name === 'media') {
        const bounds = [...parent.params.matchAll(/(max|min)-width:\s*([\d.]+)px/g)];
        if (!bounds.length || bounds.some(([, bound, size]) => bound === 'max' ? width > Number(size) : width < Number(size))) return;
      }
    }
    const declarations = result.get(rule.selector) || {};
    for (const declaration of rule.nodes) {
      if (declaration.type === 'decl') declarations[declaration.prop] = declaration.value + (declaration.important ? '!important' : '');
    }
    result.set(rule.selector, declarations);
  });
  return result;
}

async function main() {
  const html = fs.readFileSync('dist/index.html', 'utf8');
  const localJS = html.match(/src="([^"]+\.js)"/)[1];
  const localCSS = html.match(/href="([^"]+\.css)"/)[1];
  let referenceJS, referenceCSS, reference;
  if (args.includes('--js') && args.includes('--css')) {
    referenceJS = fs.readFileSync(option('--js'));
    referenceCSS = fs.readFileSync(option('--css'));
    reference = { mode: 'downloaded snapshot', js: path.basename(option('--js')), css: path.basename(option('--css')) };
  } else {
    const homepage = (await download(base)).toString('utf8');
    const js = new URL(homepage.match(/src="([^"]+\.js)"/)[1], base).href;
    const css = new URL(homepage.match(/href="([^"]+\.css)"/)[1], base).href;
    [referenceJS, referenceCSS] = await Promise.all([download(js), download(css)]);
    reference = { mode: 'live', js, css };
  }
  reference.jsSHA256 = digest(referenceJS);
  reference.cssSHA256 = digest(referenceCSS);
  const parse = (name, buffer) => ts.createSourceFile(name, buffer.toString(), ts.ScriptTarget.Latest, true);
  const online = parse('online.js', referenceJS);
  const local = parse('local.js', fs.readFileSync(path.join('dist', localJS)));
  const results = [];
  const compare = (name, expected, actual) => {
    try { assert.deepEqual(actual, expected); results.push({ name, pass: true }); }
    catch {
      results.push({ name, pass: false });
      if (args.includes('--debug') && Array.isArray(expected) && Array.isArray(actual)) {
        const index = expected.findIndex((value, offset) => value !== actual[offset]);
        console.log(name, index, expected.slice(index, index + 12), actual.slice(index, index + 12));
      }
    }
  };

  for (const marker of ['top-nav-container', 'home-page', 'search-page', 'player-page', 'audio-lab-page', 'lyrics-tool-page', 'playqueue-overlay', 'mini-player']) {
    const find = source => functions(source).find(fn => fn.getText(source).includes(JSON.stringify(marker)));
    const a = find(online), b = find(local);
    compare(`component syntax: ${marker}`, a ? syntax(a) : null, b ? syntax(b) : undefined);
  }
  const provider = source => functions(source).find(fn => ts.isArrowFunction(fn) && fn.getText(source).includes('new Audio'));
  compare('music provider syntax', syntax(provider(online)), syntax(provider(local)));
  const exportHelper = source => {
    const component = functions(source).find(fn => fn.getText(source).includes('"ranking-mode"'));
    for (const statement of component.body.statements.filter(ts.isVariableStatement)) {
      for (const declaration of statement.declarationList.declarations) {
        const text = declaration.initializer?.getText(source) || '';
        if (text.includes('sections:') && text.includes('.toBlob')) return declaration.initializer;
      }
    }
  };
  compare('DOCX export helper syntax and document layout', syntax(exportHelper(online)), syntax(exportHelper(local)));
  const service = source => source.statements.find(node => ts.isClassDeclaration(node) && node.members.some(member => member.name?.text === 'searchWithType'));
  const onlineService = service(online), localService = service(local);
  for (const method of onlineService.members.filter(ts.isMethodDeclaration)) {
    const counterpart = localService.members.find(node => node.name?.text === method.name.text);
    compare(`QQ Music API method: ${method.name.text}`, syntax(method), counterpart ? syntax(counterpart) : null);
  }

  const arrays = [];
  for (const statement of online.statements.filter(ts.isVariableStatement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (!declaration.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) continue;
      try {
        const data = literal(declaration.initializer);
        if (data.length && data.every(item => item && item.id && item.title && item.artist && typeof item.rank === 'number')) arrays.push(data);
      } catch { /* Only literal chart data is accepted; downloaded code is never run. */ }
    }
  }
  for (const kind of ['songs', 'albums']) {
    const data = JSON.parse(fs.readFileSync(`public/chart/editor-${kind}.json`, 'utf8'));
    const match = arrays.find(items => items.length === data.length && items[0].id === data[0].id);
    compare(`all ${kind} entries, covers, reviews and ranks (${data.length})`, match || null, data);
  }

  const onlineRules = cssRules(referenceCSS.toString());
  const localRules = cssRules(fs.readFileSync(path.join('dist', localCSS), 'utf8'));
  const cssDifferences = [];
  for (const [selector, declarations] of onlineRules) {
    // Tailwind's generated layer can contain extra unused tokens. App rules,
    // including every responsive breakpoint, are compared property by property.
    if (selector.startsWith('@layer')) continue;
    try { assert.deepEqual(localRules.get(selector), declarations); }
    catch { cssDifferences.push(selector); }
  }
  results.push({ name: 'all deployed app CSS rules and responsive breakpoints', pass: !cssDifferences.length, differences: cssDifferences });
  for (const width of [360, 390, 480, 768, 1024, 1440]) {
    const expected = cssAtWidth(referenceCSS.toString(), width);
    const actual = cssAtWidth(fs.readFileSync(path.join('dist', localCSS), 'utf8'), width);
    const mismatches = [];
    for (const [selector, declarations] of expected) {
      try { assert.deepEqual(actual.get(selector), declarations); }
      catch { mismatches.push(selector); }
    }
    results.push({ name: `CSS declaration order at ${width}px`, pass: !mismatches.length, differences: mismatches });
  }
  if (args.includes('--assets')) {
    const assets = new Set();
    const collect = node => {
      if (ts.isStringLiteral(node) && /^\/(?:artists\/images|images)\//.test(node.text)) assets.add(node.text);
      ts.forEachChild(node, collect);
    };
    collect(online);
    const checks = await Promise.allSettled([...assets].map(async asset => {
      const deployed = await download(new URL(asset, base));
      const filename = path.join('public', asset);
      return { name: `asset SHA256: ${asset}`, pass: fs.existsSync(filename) && digest(deployed) === digest(fs.readFileSync(filename)) };
    }));
    checks.forEach((check, index) => results.push(check.status === 'fulfilled' ? check.value : { name: `asset download: ${[...assets][index]}`, pass: false, error: check.reason.message }));
  }
  const report = { reference, checkedAt: new Date().toISOString(), results,
    note: 'Syntax and CSS-rule equivalence are static evidence, not proof of all runtime states or external service availability.' };
  fs.mkdirSync('docs/audit', { recursive: true });
  fs.writeFileSync('docs/audit/static-verification.json', JSON.stringify(report, null, 2) + '\n');
  for (const result of results) console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}`);
  if (cssDifferences.length) console.log('CSS differences:', cssDifferences.join(', '));
  if (results.some(result => !result.pass)) process.exitCode = 1;
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
