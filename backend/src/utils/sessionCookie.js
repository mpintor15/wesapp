/**
 * sessionCookie.js — Cookie de sesión HttpOnly que transporta el JWT
 *
 * El token ya no necesita vivir en localStorage (legible por cualquier XSS):
 * el navegador lo envía solo en /api con SameSite=Strict y el JS de la página
 * no puede leerlo.
 */
const jwt = require('jsonwebtoken');
const config = require('../config/config');

const SESSION_COOKIE_NAME = 'wes_session';
const SESSION_COOKIE_PATH = '/api';
const CSRF_HEADER_NAME = 'x-requested-with';
const CSRF_HEADER_VALUE = 'XMLHttpRequest';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const baseCookieOptions = () => ({
  httpOnly: true,
  secure: config.cookies.secure,
  sameSite: 'strict',
  path: SESSION_COOKIE_PATH,
});

const parseCookies = (header) => {
  const cookies = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) {
      continue;
    }
    const name = part.slice(0, index).trim();
    if (!name || name in cookies) {
      continue;
    }
    try {
      cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      // Valor mal codificado: se ignora esa cookie.
    }
  }
  return cookies;
};

const readSessionToken = (req) => parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME] || null;

const setSessionCookie = (res, token) => {
  const exp = jwt.decode(token)?.exp;
  const maxAge = exp ? Math.max(exp * 1000 - Date.now(), 0) : undefined;
  res.cookie(SESSION_COOKIE_NAME, token, { ...baseCookieOptions(), maxAge });
};

const clearSessionCookie = (res) => {
  res.clearCookie(SESSION_COOKIE_NAME, baseCookieOptions());
};

// Defensa CSRF adicional a SameSite: una petición que modifica estado y se
// autentica por cookie debe traer un header que un sitio externo no puede
// enviar sin pasar por CORS.
const hasCsrfHeader = (req) => req.headers[CSRF_HEADER_NAME] === CSRF_HEADER_VALUE;

const isSafeMethod = (req) => SAFE_METHODS.has(req.method);

module.exports = {
  SESSION_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
  clearSessionCookie,
  hasCsrfHeader,
  isSafeMethod,
  parseCookies,
  readSessionToken,
  setSessionCookie,
};
