import AsyncStorage from '@react-native-async-storage/async-storage';
// expo/fetch ships with Expo SDK 56 and is the ONLY fetch here whose Response
// exposes a streaming body (`res.body.getReader()`). The global RN fetch buffers
// the whole response, so SSE must go through this import. Pure JS — no native
// module — which keeps the streaming chat OTA-pushable via EAS Update.
import { fetch as expoFetch } from 'expo/fetch';

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

// ── SSE streaming (Ask AI) ───────────────────────────────────────────────────
// Streams a Server-Sent-Events POST and calls onEvent(evt) for every `data:` JSON
// line. Mirrors the web client's reader loop in ask/index.html so the on-the-wire
// contract is identical (events: metadata / stream_start / text_delta / stream_end
// / done / error). Resolves when the stream closes; rejects on transport error,
// abort (signal), or a non-OK status (paywall 402, etc. — error carries .status/.data).
async function streamSSE(path, body, { signal, onEvent } = {}, retried = false) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await expoFetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (res.status === 401 && !retried) {
    try {
      await refreshAccessToken();
    } catch {
      await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
      throw new Error('SESSION_EXPIRED');
    }
    return streamSSE(path, body, { signal, onEvent }, true);
  }

  if (!res.ok) {
    let data = {};
    try { data = await res.json(); } catch (_) {}
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE frames are newline-delimited; keep the trailing partial line buffered.
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;   // skips `: keepalive` comments
      let evt;
      try { evt = JSON.parse(line.slice(6)); } catch (_) { continue; }
      if (onEvent) onEvent(evt);
    }
  }
}

export const api = {
  get: (path) => apiFetch(path),
  stream: streamSSE,
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
