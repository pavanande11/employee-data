// The session token is kept in sessionStorage: it survives a refresh but is wiped when the tab/window is closed.
const KEY = 'token';

export async function api(url, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const t = sessionStorage.getItem(KEY);
  if (t) headers.Authorization = 'Bearer ' + t;
  if (url === '/auth/logout') sessionStorage.removeItem(KEY);
  const r = await fetch('/api' + url, { method, headers, body: body && JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty body */ }
  if (r.status === 401) {
    sessionStorage.removeItem(KEY);
    if (!url.includes('login') && url !== '/auth/me') window.dispatchEvent(new Event('session-expired'));
  }
  if (!r.ok) throw Object.assign(new Error(j.message || 'Something went wrong'), { status: r.status });
  if (j.data?.token) { sessionStorage.setItem(KEY, j.data.token); delete j.data.token; }
  return j;
}
