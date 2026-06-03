import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://tastebuddy-colinchia2.pythonanywhere.com';

async function getToken() {
  return AsyncStorage.getItem('access_token');
}

async function refreshAccessToken() {
  const refresh = await AsyncStorage.getItem('refresh_token');
  if (!refresh) throw new Error('No refresh token');
  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) throw new Error('Refresh failed');
  const data = await res.json();
  await AsyncStorage.setItem('access_token', data.access_token);
  return data.access_token;
}

async function apiFetch(path, options = {}, retried = false) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timeoutMs = path.includes('/api/ask/') ? 90000 : 30000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401 && !retried) {
    try {
      await refreshAccessToken();
      return apiFetch(path, options, true);
    } catch {
      await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
      throw new Error('SESSION_EXPIRED');
    }
  }

  return res;
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => apiFetch(path, { method: 'DELETE' }),

  async json(path, options) {
    const res = await apiFetch(path, options);
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Server error (${res.status})`);
    }
    if (!res.ok) {
      // Preserve structured fields (e.g. need_city, need_location_confirm) so
      // callers can react, not just read err.message.
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      err.need_city = !!data.need_city;
      err.need_location_confirm = !!data.need_location_confirm;
      err.location = data.location || null;
      throw err;
    }
    return data;
  },

  async upload(path, formData, retried = false) {
    const token = await getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData });
    if (res.status === 401 && !retried) {
      try {
        await refreshAccessToken();
        return api.upload(path, formData, true);
      } catch {
        await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
        throw new Error('SESSION_EXPIRED');
      }
    }
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Server error (${res.status})`);
    }
    if (!res.ok) {
      // Preserve structured fields (e.g. need_city, need_location_confirm) so
      // callers can react, not just read err.message.
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      err.need_city = !!data.need_city;
      err.need_location_confirm = !!data.need_location_confirm;
      err.location = data.location || null;
      throw err;
    }
    return data;
  },
};

export { BASE_URL };
