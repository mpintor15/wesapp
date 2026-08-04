const path = require('node:path');

const SEVERITIES = {
  BLOCKING: 'Bloqueante',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const SENSITIVE_QUERY_KEYS = /token|password|authorization|cookie|secret|jwt/i;
const EXPECTED_NAVIGATION_CANCELLATIONS = /net::ERR_ABORTED|NS_BINDING_ABORTED|navigation/i;

const severityRank = {
  [SEVERITIES.BLOCKING]: 4,
  [SEVERITIES.HIGH]: 3,
  [SEVERITIES.MEDIUM]: 2,
  [SEVERITIES.LOW]: 1,
};

const sanitizeUrl = (rawUrl) => {
  if (!rawUrl) return '';

  try {
    const url = new URL(rawUrl);
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.test(key)) {
        url.searchParams.set(key, '[redacted]');
      }
    }
    url.hash = '';
    return url.toString();
  } catch (_error) {
    return String(rawUrl).replace(SENSITIVE_QUERY_KEYS, '[redacted]');
  }
};

const isLocalUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    return LOCAL_HOSTS.has(url.hostname);
  } catch (_error) {
    return false;
  }
};

const normalizeConsoleMessage = (message) => ({
  type: message.type(),
  text: message.text(),
  location: message.location(),
});

const buildFinding = ({ severity, category, message, evidence = {} }) => ({
  severity,
  category,
  message,
  evidence,
});

const classifyFailedRequest = (request) => {
  const failure = request.failure()?.errorText || 'unknown request failure';
  if (EXPECTED_NAVIGATION_CANCELLATIONS.test(failure)) {
    return null;
  }

  return {
    url: sanitizeUrl(request.url()),
    method: request.method(),
    failure,
    severity: SEVERITIES.MEDIUM,
  };
};

const classifyResponseIssue = (response) => {
  const status = response.status();
  const url = response.url();

  if (isLocalUrl(url) && status >= 500) {
    return {
      url: sanitizeUrl(url),
      status,
      severity: SEVERITIES.HIGH,
      message: `Respuesta local HTTP ${status}`,
    };
  }

  if ([401, 403].includes(status) && !/\/api\/auth\/login/.test(url)) {
    return {
      url: sanitizeUrl(url),
      status,
      severity: SEVERITIES.HIGH,
      message: `Respuesta inesperada HTTP ${status}`,
    };
  }

  return null;
};

const collectVisibleBrokenImages = async (page) =>
  page.locator('img:visible').evaluateAll((images) =>
    images
      .map((image) => ({
        src: image.currentSrc || image.src || '',
        alt: image.alt || '',
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        width: image.getBoundingClientRect().width,
        height: image.getBoundingClientRect().height,
      }))
      .filter(
        (image) =>
          image.width > 0 &&
          image.height > 0 &&
          (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0)
      )
  );

const getResultFromFindings = (findings) => {
  if (findings.some((finding) => finding.severity === SEVERITIES.BLOCKING)) {
    return 'failed';
  }
  if (findings.some((finding) => finding.severity === SEVERITIES.HIGH)) {
    return 'needs-review';
  }
  return 'passed';
};

const countFindingsBySeverity = (screens) => {
  const counts = {
    blocking: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const screen of screens) {
    for (const finding of screen.findings || []) {
      if (finding.severity === SEVERITIES.BLOCKING) counts.blocking += 1;
      if (finding.severity === SEVERITIES.HIGH) counts.high += 1;
      if (finding.severity === SEVERITIES.MEDIUM) counts.medium += 1;
      if (finding.severity === SEVERITIES.LOW) counts.low += 1;
    }
  }

  return counts;
};

const summarizeCheck = (items, okLabel = 'OK') => (items.length === 0 ? okLabel : String(items.length));

const toPosixPath = (filePath) => filePath.split(path.sep).join('/');

module.exports = {
  SEVERITIES,
  buildFinding,
  classifyFailedRequest,
  classifyResponseIssue,
  collectVisibleBrokenImages,
  countFindingsBySeverity,
  getResultFromFindings,
  normalizeConsoleMessage,
  sanitizeUrl,
  severityRank,
  summarizeCheck,
  toPosixPath,
};
