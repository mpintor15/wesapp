const fs = require('node:fs');
const path = require('node:path');

const buildDir = path.resolve(__dirname, '..', 'build');
const localEndpointPattern =
  /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d{1,5})?(?:\/[^\s"'`<>)\\]*)?/gi;
const readableExtensions = new Set(['.js', '.css', '.html', '.json', '.map']);
const sourceMapReferencePattern = /(?:sourceMappingURL\s*=\s*[^\s"'`<>)]+\.map\b|["'][^"']*\.map["'])/gi;

const allowedLocalhostContexts = [
  {
    description: 'Axios browser origin fallback without port or path',
    pattern: /window\.location\.href\|\|"http:\/\/localhost"/,
  },
  {
    description: 'Axios source map browser origin fallback without port or path',
    pattern: /window\.location\.href\) \|\| 'http:\/\/localhost'/,
  },
  {
    description: 'React Router source map URL constructor base without port or path',
    pattern: /new URL\(createHref\(to\), \\"http:\/\/localhost\\"\)/,
  },
  {
    description: 'React Router browserless URL constructor base without port or path',
    pattern: /"http:\/\/localhost".{0,260}No window\.location\.\(origin\|href\) available to create URL/,
  },
  {
    description:
      'React Router internal createHref/createURL base URL (minified shape, react-router-dom 7.18.3)',
    pattern: /new URL\("http:\/\/localhost"\)[\s\S]{0,200}createHref/,
  },
];

const walk = (dir) => {
  if (!fs.existsSync(dir)) {
    throw new Error(`No existe el directorio del build: ${dir}`);
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
};

const getContext = (content, index, size = 180) =>
  content.slice(Math.max(0, index - size), Math.min(content.length, index + size));

const isAllowedLocalhostReference = (match, context) =>
  match === 'http://localhost' &&
  allowedLocalhostContexts.some(({ pattern }) => pattern.test(context));

const findLocalEndpoints = (content, filePath = '') => {
  localEndpointPattern.lastIndex = 0;
  const offenders = [];
  let match;

  while ((match = localEndpointPattern.exec(content)) !== null) {
    const value = match[0];
    const context = getContext(content, match.index);

    if (!isAllowedLocalhostReference(value, context)) {
      offenders.push({
        filePath,
        value,
        context,
      });
    }
  }

  return offenders;
};

const findSourceMapReferences = (content, filePath = '') => {
  sourceMapReferencePattern.lastIndex = 0;
  const offenders = [];
  let match;

  while ((match = sourceMapReferencePattern.exec(content)) !== null) {
    offenders.push({
      filePath,
      value: match[0],
      context: getContext(content, match.index),
      type: 'sourcemap-reference',
    });
  }

  return offenders;
};

const checkProductionBundle = (dir = buildDir) => {
  const offenders = [];

  for (const file of walk(dir)) {
    if (path.extname(file) === '.map') {
      offenders.push({
        filePath: file,
        value: path.basename(file),
        type: 'sourcemap-file',
      });
      continue;
    }

    if (!readableExtensions.has(path.extname(file))) {
      continue;
    }

    const content = fs.readFileSync(file, 'utf8');
    offenders.push(...findLocalEndpoints(content, file));
    offenders.push(...findSourceMapReferences(content, file));
  }

  return offenders;
};

const formatOffender = ({ filePath, value }) => {
  const relativePath = filePath ? path.relative(process.cwd(), filePath) : '<contenido>';
  return `${relativePath} contiene referencia prohibida "${value}"`;
};

if (require.main === module) {
  const offenders = checkProductionBundle();

  if (offenders.length > 0) {
    console.error('El build de producción contiene endpoints locales o sourcemaps prohibidos:');
    offenders.forEach((offender) => console.error(`- ${formatOffender(offender)}`));
    process.exit(1);
  }

  console.log('Build verificado: sin endpoints locales funcionales ni sourcemaps públicos.');
}

module.exports = {
  checkProductionBundle,
  findLocalEndpoints,
  findSourceMapReferences,
  formatOffender,
  isAllowedLocalhostReference,
};
