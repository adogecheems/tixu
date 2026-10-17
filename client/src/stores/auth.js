import { reactive } from 'vue';
import { get, post } from '@/lib/api.js';

export const authState = reactive({
  user: null,
  ready: false,
  loading: false,
});

export async function loadSession() {
  authState.loading = true;
  try {
    const data = await get('/auth/me');
    authState.user = data.user || null;
  } catch {
    authState.user = null;
  } finally {
    authState.loading = false;
    authState.ready = true;
  }
  return authState.user;
}

function announceLogin(source) {
  window.dispatchEvent(
    new CustomEvent('tixu:login', {
      detail: { source, user: authState.user },
    }),
  );
}

export async function login(username, password) {
  authState.loading = true;
  try {
    const data = await post('/auth/login', { username, password });
    authState.user = data.user;
    authState.ready = true;
    announceLogin('login');
    return data;
  } finally {
    authState.loading = false;
  }
}

export async function register(username, password) {
  authState.loading = true;
  try {
    const data = await post('/auth/register', { username, password });
    authState.user = data.user;
    authState.ready = true;
    announceLogin('register');
    return data;
  } finally {
    authState.loading = false;
  }
}

export async function logout() {
  try {
    await post('/auth/logout', {});
  } finally {
    authState.user = null;
    window.dispatchEvent(new CustomEvent('tixu:logout'));
  }
}

export function isAdmin(user = authState.user) {
  return user?.role === 'admin';
}

export function clearAuthState() {
  authState.user = null;
}
