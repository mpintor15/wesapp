const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  checkProductionBundle,
  findLocalEndpoints,
  findSourceMapReferences,
} = require('./check-production-bundle');

const withBuild = (files, callback) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wesapp-bundle-'));
  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const filePath = path.join(dir, relativePath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
    }
    callback(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test('rechaza endpoints locales con distintos hosts, protocolos y puertos', () => {
  const cases = [
    'const API_URL = "http://localhost:3000/api";',
    'const API_URL = "http://localhost:3001/api";',
    'const API_URL = "https://localhost/api";',
    'const API_URL = "http://127.0.0.1:8080";',
    'const API_URL = "http://0.0.0.0:3000";',
    'const API_URL = "http://[::1]:3000/api";',
    '(()=>{var e="http://localhost:3000/api"})();',
  ];

  for (const source of cases) {
    assert.equal(findLocalEndpoints(source).length, 1, source);
  }
});

test('permite endpoints productivos y rutas relativas', () => {
  const source = [
    'const API_URL = "/api";',
    'const external = "https://api.wessecurity.com.ec";',
    'const docs = "sin endpoints locales";',
  ].join('\n');

  assert.deepEqual(findLocalEndpoints(source), []);
});

test('permite únicamente constantes internas conocidas sin puerto ni ruta', () => {
  const axiosBundle = 'sn=nn&&window.location.href||"http://localhost",ln=De(De({},a),tn);';
  const axiosSourceMap =
    "const origin = (hasBrowserEnv && window.location.href) || 'http://localhost';";
  const routerSourceMap = 'return new URL(createHref(to), \\"http://localhost\\");';

  assert.deepEqual(findLocalEndpoints(axiosBundle), []);
  assert.deepEqual(findLocalEndpoints(axiosSourceMap), []);
  assert.deepEqual(findLocalEndpoints(routerSourceMap), []);
});

test('rechaza localhost genérico fuera de los contextos documentados', () => {
  const source = 'const API_URL = "http://localhost";';

  assert.equal(findLocalEndpoints(source).length, 1);
});

test('rechaza referencias sourceMappingURL en JS y CSS', () => {
  assert.equal(findSourceMapReferences('console.log(1);\n//# sourceMappingURL=main.js.map').length, 1);
  assert.equal(
    findSourceMapReferences('body{color:#111}\n/*# sourceMappingURL=main.css.map */').length,
    1
  );
});

test('rechaza sourcemaps públicos y referencias en asset-manifest', () => {
  withBuild(
    {
      'asset-manifest.json': JSON.stringify({
        files: {
          'main.js': '/static/js/main.abc123.js',
          'main.js.map': '/static/js/main.abc123.js.map',
        },
      }),
      'static/js/main.abc123.js': 'console.log(1);',
      'static/js/main.abc123.js.map': '{}',
      'static/css/main.abc123.css.map': '{}',
    },
    (dir) => {
      const offenders = checkProductionBundle(dir);
      assert.ok(offenders.some((offender) => offender.type === 'sourcemap-file'));
      assert.ok(offenders.some((offender) => offender.type === 'sourcemap-reference'));
    }
  );
});

test('rechaza sourcemap anidado y con hash', () => {
  withBuild(
    {
      'static/js/chunks/main.8f1a2b3c.js.map': '{}',
    },
    (dir) => {
      const offenders = checkProductionBundle(dir);
      assert.equal(offenders.length, 1);
      assert.equal(offenders[0].type, 'sourcemap-file');
    }
  );
});

test('permite build sin sourcemaps, sin sourceMappingURL y con API relativa', () => {
  withBuild(
    {
      'asset-manifest.json': JSON.stringify({
        files: {
          'main.js': '/static/js/main.js',
          'main.css': '/static/css/main.css',
        },
      }),
      'static/js/main.js': 'const API_URL="/api"; console.log(API_URL);',
      'static/css/main.css': 'body{color:#111}',
      'manifest.json': JSON.stringify({ name: 'WESApp' }),
      'index.html': '<script src="/static/js/main.js"></script>',
    },
    (dir) => {
      assert.deepEqual(checkProductionBundle(dir), []);
    }
  );
});
