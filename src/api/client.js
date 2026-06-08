import AsyncStorage from '@react-native-async-storage/async-storage';
// expo/fetch ships with Expo SDK 56 and is the ONLY fetch here whose Response
// exposes a streaming body (`res.body.getReader()`). The global RN fetch buffers
// the whole response, so SSE must go through this import. Pure JS — no native
// module — which keeps the streaming chat OTA-pushable via EAS Update.
import { fetch as expoFetch } from 'expo/fetch';
// Native multipart file upload. RN 0.85's New Architecture rejects fetch+FormData
// file parts ("Unsupported Form Data Part implementation"), so photo uploads go
// through expo-file-system's uploadAsync instead. Legacy import — the native
// module already ships in build 3, so this stays OTA-pushable.
import * as FileSystem from 'expo-file-system/legacy';

const BASE_URL = 'https://tastebuddy-colinchia2.pythonanywhere.com';

// The upload endpoint validates the filename extension; uploadAsync derives the
// multipart filename from the file uri. expo-image-picker cache uris normally
// carry an extension, but if one is missing/odd we copy to a .jpg cache path so
// the server accepts it (it re-encodes to JPEG via Pillow regardless).
const _OK_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
async function _ensureUploadableUri(uri) {
  const base = (String(uri || '').split('/').pop() || '').split('?')[0].split('#')[0];
  const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';
  if (_OK_EXT.includes(ext)) return uri;
  try {
    const dest = `${FileSystem.cacheDirectory}tb_upload_${base || 'photo'}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

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

  // Multipart file upload via expo-file-system (New-Architecture-safe). `fields`
  // become form fields; the file is sent under `file`. Mirrors api.upload's
  // 401-refresh + structured-error behaviour.
  async uploadFile(path, fileUri, fields = {}, retried = false) {
    const token = await getToken();
    const uri = await _ensureUploadableUri(fileUri);
    const parameters = {};
    Object.keys(fields).forEach((k) => { parameters[k] = String(fields[k]); });
    const res = await FileSystem.uploadAsync(`${BASE_URL}${path}`, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'image/jpeg',
      parameters,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 401 && !retried) {
      try {
        await refreshAccessToken();
        return api.uploadFile(path, fileUri, fields, true);
      } catch {
        await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
        throw new Error('SESSION_EXPIRED');
      }
    }
    let data;
    try {
      data = JSON.parse(res.body || '{}');
    } catch {
      throw new Error(`Server error (${res.status})`);
    }
    if (res.status < 200 || res.status >= 300) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },
};

export { BASE_URL };
