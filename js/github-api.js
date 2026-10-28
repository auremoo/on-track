const BASE = 'https://api.github.com';

let _config = null;

export function configure({ token, owner, repo, branch = 'main' }) {
  _config = { token, owner, repo, branch };
}

function getConfig() {
  return _config;
}

function headers() {
  const { token } = getConfig();
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };
}

function apiUrl(path) {
  const { owner, repo } = getConfig();
  return `${BASE}/repos/${owner}/${repo}/contents/${path}`;
}

export async function getFile(path, { rawBase64 = false } = {}) {
  const { branch } = getConfig();
  const url = `${apiUrl(path)}?ref=${branch}&_t=${Date.now()}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`GitHub GET ${path}: ${res.status}`);
  }
  const data = await res.json();

  // Files > 1MB: GitHub returns empty content + download_url for raw access
  if (rawBase64) {
    let b64 = (data.content || '').replace(/\n/g, '');
    if (!b64 && data.download_url) {
      const raw = await fetch(data.download_url);
      const buf = await raw.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      bytes.forEach(b => { binary += String.fromCharCode(b); });
      b64 = btoa(binary);
    }
    return { content: b64, sha: data.sha };
  }

  return {
    content: decodeBase64(data.content),
    sha: data.sha
  };
}

export async function putFile(path, content, sha, { alreadyBase64 = false, commitMessage = null } = {}) {
  const { branch } = getConfig();
  const body = {
    message: commitMessage || `on-track: update ${path}`,
    content: alreadyBase64 ? content : encodeBase64(content),
    branch
  };
  if (sha) body.sha = sha;

  const res = await fetch(apiUrl(path), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub PUT ${path}: ${res.status} — ${err.message || ''}`);
  }
  const data = await res.json();
  return data.content.sha;
}

export async function testConnection() {
  const { owner, repo } = getConfig();
  const res = await fetch(`${BASE}/repos/${owner}/${repo}`, { headers: headers() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { repoName: data.full_name, private: data.private };
}

function decodeBase64(b64) {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}
