const API_PREFIX = '/api/v1';
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/me', '/auth/csrf'];

export class ApiError extends Error {
  constructor(message, { code = 'REQUEST_FAILED', status = 0, details = undefined } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const value = part.trim();
    if (value.startsWith(prefix)) return decodeURIComponent(value.slice(prefix.length));
  }
  return null;
}

let csrfBootstrap = null;

async function ensureCsrfToken() {
  if (readCookie('tixu_csrf')) return;
  if (!csrfBootstrap) {
    csrfBootstrap = fetch(`${API_PREFIX}/auth/me`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    }).finally(() => {
      csrfBootstrap = null;
    });
  }
  await csrfBootstrap;
  if (!readCookie('tixu_csrf')) {
    throw new ApiError('无法建立安全会话，请刷新页面后重试。', {
      code: 'CSRF_UNAVAILABLE',
    });
  }
}

function buildUrl(path, query) {
  if (!query) return `${API_PREFIX}${path}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `${API_PREFIX}${path}${qs ? `?${qs}` : ''}`;
}

export async function api(path, { method = 'GET', body, query, headers = {}, signal } = {}) {
  const unsafe = !['GET', 'HEAD'].includes(method.toUpperCase());
  if (unsafe) await ensureCsrfToken();

  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  };
  let payload = body;
  if (body !== undefined && body !== null && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (unsafe) {
    const csrf = readCookie('tixu_csrf');
    if (csrf) requestHeaders['X-CSRF-Token'] = csrf;
  }

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      headers: requestHeaders,
      body: payload,
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('网络连接不可用，请检查网络后重试。', { code: 'NETWORK_ERROR' });
  }

  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorPayload = data?.error || {};
    const apiError = new ApiError(errorPayload.message || '请求未能完成，请稍后重试。', {
      code: errorPayload.code || 'REQUEST_FAILED',
      status: response.status,
      details: errorPayload.details,
    });
    if (
      response.status === 401 &&
      !AUTH_PATHS.some((authPath) => path.startsWith(authPath)) &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(new CustomEvent('tixu:unauthorized'));
    }
    throw apiError;
  }

  return data;
}

export function get(path, query, options = {}) {
  return api(path, { ...options, query });
}

export function post(path, body, options = {}) {
  return api(path, { ...options, method: 'POST', body });
}

export function put(path, body, options = {}) {
  return api(path, { ...options, method: 'PUT', body });
}

export function patch(path, body, options = {}) {
  return api(path, { ...options, method: 'PATCH', body });
}

export function del(path, options = {}) {
  return api(path, { ...options, method: 'DELETE' });
}

export async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  return api('/admin/uploads', { method: 'POST', body: formData });
}

export function getErrorMessage(error, fallback = '操作未能完成，请稍后重试。') {
  if (error instanceof ApiError) return error.message || fallback;
  if (error?.message) return error.message;
  return fallback;
}
