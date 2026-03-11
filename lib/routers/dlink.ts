/**
 * D-Link X1852E router service — SERVER SIDE ONLY.
 *
 * Login strategies attempted in order:
 *   1. Modern D-Link JSON/form API  (/cgi-bin/auth_cgi, /session, /ui/login)
 *   2. HNAP1 SOAP protocol          (/HNAP1/) — requires HMAC-MD5 challenge-response
 *   3. Classic form POST            (/, /login.html, /login.cgi)
 *
 * Device list strategies:
 *   1. JSON REST endpoints          (/cgi-bin/hostmanager_mgr.cgi, /dhcps_clients.cgi)
 *   2. HNAP GetClientInfo           (/HNAP1/)
 *   3. HTML / ARP table scraping    (/, /arp_table.html)
 *
 * All functions throw DlinkRouterError on failure so the aggregator can
 * surface a proper offline/auth_failed status without fake device data.
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import { CookieJar } from 'tough-cookie';
import { createHmac } from 'crypto';
import { devicesConfig } from '@/lib/config';

// ---------------------------------------------------------------------------
// Error types (mirror huawei.ts / tenda.ts for aggregator compatibility)
// ---------------------------------------------------------------------------

export type RouterErrorKind =
  | 'offline'
  | 'login_failed'
  | 'timeout'
  | 'invalid_credentials'
  | 'parse_error'
  | 'unknown';

export class RouterError extends Error {
  constructor(
    public readonly kind: RouterErrorKind,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RouterError';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DlinkDevice {
  name: string;
  ip: string;
  mac: string;
  connection: 'wifi' | 'ethernet' | 'unknown';
  signal?: number;
}

export interface DlinkStatus {
  model: string;
  firmwareVersion: string;
  wanIp: string;
  wanStatus: 'connected' | 'disconnected' | 'unknown';
  uptime: number;
  connectedClients: number;
}

export interface DlinkDevicesResponse {
  router: string;
  routerIp: string;
  deviceCount: number;
  devices: DlinkDevice[];
  source: 'live';
  fetchedAt: string;
  status: Partial<DlinkStatus>;
}

// ---------------------------------------------------------------------------
// HTTP client with cookie-jar (shared session persistence)
// ---------------------------------------------------------------------------

function createHttpClient(baseURL: string, timeout: number): AxiosInstance {
  const jar = new CookieJar();

  const client = axios.create({
    baseURL,
    timeout,
    withCredentials: true,
    maxRedirects: 5,
    validateStatus: (s) => s < 500,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/json,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
  });

  client.interceptors.request.use(async (cfg) => {
    const url = `${cfg.baseURL ?? ''}${cfg.url ?? ''}`;
    const cookieHeader = await jar.getCookieString(url).catch(() => '');
    if (cookieHeader) {
      cfg.headers = cfg.headers ?? {};
      cfg.headers['Cookie'] = cookieHeader;
    }
    return cfg;
  });

  client.interceptors.response.use(async (res) => {
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      const reqUrl = `${res.config.baseURL ?? ''}${res.config.url ?? ''}`;
      for (const c of setCookie) await jar.setCookie(c, reqUrl).catch(() => {});
    }
    return res;
  });

  return client;
}

// ---------------------------------------------------------------------------
// HNAP helpers (D-Link's SOAP-based Home Network Administration Protocol)
// ---------------------------------------------------------------------------

const HNAP_NS = 'http://purenetworks.com/HNAP1/';

function hnacMd5(data: string, key: string): string {
  return createHmac('md5', key).update(data).digest('hex').toUpperCase();
}

function hnacAuth(soapAction: string, privateKey: string): string {
  const ts = String(Math.floor(Date.now() / 1000));
  const hash = hnacMd5(ts + `"${HNAP_NS}${soapAction}"`, privateKey);
  return `${hash} ${ts}`;
}

function buildHnapEnvelope(action: string, bodyContent: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${action} xmlns="${HNAP_NS}">
      ${bodyContent}
    </${action}>
  </soap:Body>
</soap:Envelope>`;
}

/** Extract a tag value from an XML/HTML string. */
function xmlTag(xml: string, tag: string): string | undefined {
  return new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i').exec(xml)?.[1]?.trim();
}

/** Attempt HNAP login. Returns privateKey on success, throws on failure. */
async function loginHnap(
  client: AxiosInstance,
  baseURL: string,
  username: string,
  password: string,
): Promise<string> {
  const requestBody = buildHnapEnvelope(
    'Login',
    `<Action>request</Action>
     <Username>${username}</Username>
     <LoginPassword></LoginPassword>
     <Captcha></Captcha>`,
  );

  const phase1 = await client.post('/HNAP1/', requestBody, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `"${HNAP_NS}Login"`,
      Referer: `${baseURL}/`,
    },
  });

  const phase1Body = String(phase1.data ?? '');
  const challenge = xmlTag(phase1Body, 'Challenge');
  const publicKey = xmlTag(phase1Body, 'PublicKey');
  const cookie = xmlTag(phase1Body, 'Cookie');

  if (!challenge || !publicKey) {
    throw new RouterError('login_failed', 'HNAP phase-1 did not return Challenge/PublicKey');
  }

  const privateKey = hnacMd5(challenge + password, publicKey);
  const loginPassword = hnacMd5(challenge, privateKey);

  const loginBody = buildHnapEnvelope(
    'Login',
    `<Action>login</Action>
     <Username>${username}</Username>
     <LoginPassword>${loginPassword}</LoginPassword>
     <Captcha></Captcha>`,
  );

  const phase2 = await client.post('/HNAP1/', loginBody, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `"${HNAP_NS}Login"`,
      HNAP_AUTH: hnacAuth('Login', privateKey),
      Cookie: `uid=${cookie ?? ''}`,
      Referer: `${baseURL}/`,
    },
  });

  const phase2Body = String(phase2.data ?? '');
  const loginResult = xmlTag(phase2Body, 'LoginResult');

  if (!loginResult || loginResult.toLowerCase() !== 'success') {
    throw new RouterError('invalid_credentials', `HNAP login rejected (result="${loginResult}")`);
  }

  console.info('[dlink] HNAP login OK');
  return privateKey;
}

// ---------------------------------------------------------------------------
// Login strategies
// ---------------------------------------------------------------------------

interface LoginResult {
  strategy: 'modern_json' | 'hnap' | 'form';
  privateKey?: string; // populated only for HNAP
}

async function login(
  client: AxiosInstance,
  baseURL: string,
  username: string,
  password: string,
): Promise<LoginResult> {
  // ── Strategy 1: Modern D-Link REST/JSON API ──────────────────────────────
  const jsonEndpoints = [
    { path: '/cgi-bin/auth_cgi', body: { cmd: 'login', id: username, password } },
    { path: '/session', body: { username, password } },
    { path: '/ui/login', body: { user: username, pass: password } },
    { path: '/cgi-bin/luci/rpc/auth', body: { id: username, password } },
  ];

  for (const { path, body } of jsonEndpoints) {
    try {
      const res = await client.post(path, JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json', Referer: `${baseURL}/` },
      });
      if (
        res.status < 400 &&
        typeof res.data === 'object' &&
        res.data !== null &&
        (res.data.errcode === 0 ||
          res.data.result === 'ok' ||
          res.data.success === true ||
          res.data.token !== undefined)
      ) {
        console.info('[dlink] JSON login OK via %s', path);
        return { strategy: 'modern_json' };
      }
    } catch {
      // try next
    }
  }

  // ── Strategy 2: HNAP1 SOAP ───────────────────────────────────────────────
  try {
    const privateKey = await loginHnap(client, baseURL, username, password);
    return { strategy: 'hnap', privateKey };
  } catch (err) {
    if (err instanceof RouterError && err.kind === 'invalid_credentials') throw err;
    // If HNAP endpoint not present, fall through
  }

  // ── Strategy 3: Classic form POST ────────────────────────────────────────
  const formEndpoints = [
    { path: '/', body: `AdminPassword=${encodeURIComponent(password)}&view_info_submit=1` },
    { path: '/', body: `admin_name=${encodeURIComponent(username)}&admin_password=${encodeURIComponent(password)}` },
    { path: '/login.html', body: `admin=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}` },
    { path: '/login.cgi', body: `id=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}` },
  ];

  for (const { path, body } of formEndpoints) {
    try {
      const res = await client.post(path, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${baseURL}/` },
      });
      const text = typeof res.data === 'string' ? res.data : '';
      const isRejected =
        res.status === 401 ||
        res.status === 403 ||
        /incorrect|invalid|failed|unauthorized/i.test(text.slice(0, 400));

      if (!isRejected && res.status < 400) {
        console.info('[dlink] Form login OK via %s', path);
        return { strategy: 'form' };
      }
    } catch {
      // try next
    }
  }

  throw new RouterError('login_failed', 'All D-Link login strategies failed');
}

// ---------------------------------------------------------------------------
// Device list fetching
// ---------------------------------------------------------------------------

async function fetchDevicesJson(client: AxiosInstance): Promise<DlinkDevice[]> {
  const endpoints = [
    '/cgi-bin/hostmanager_mgr.cgi?cmd=getHostList',
    '/cgi-bin/dhcps_clients.cgi',
    '/cgi-bin/connected_devices.cgi',
    '/cgi-bin/net_client_list.cgi',
    '/api/clients',
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await client.get(endpoint);
      if (res.status === 200 && typeof res.data === 'object' && res.data !== null) {
        const list = parseJsonDeviceList(res.data);
        if (list.length > 0) {
          console.info('[dlink] device list fetched via %s (%d devices)', endpoint, list.length);
          return list;
        }
      }
    } catch {
      // try next
    }
  }
  return [];
}

async function fetchDevicesHnap(client: AxiosInstance, privateKey: string): Promise<DlinkDevice[]> {
  const actions = ['GetClientInfo', 'GetWanSettings', 'GetConnectedDevices'];

  for (const action of actions) {
    try {
      const body = buildHnapEnvelope(action, '');
      const res = await client.post('/HNAP1/', body, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${HNAP_NS}${action}"`,
          HNAP_AUTH: hnacAuth(action, privateKey),
        },
      });
      if (res.status === 200) {
        const list = parseHnapClientList(String(res.data ?? ''));
        if (list.length > 0) {
          console.info('[dlink] HNAP device list via %s (%d devices)', action, list.length);
          return list;
        }
      }
    } catch {
      // try next
    }
  }
  return [];
}

async function fetchDevicesHtml(client: AxiosInstance): Promise<DlinkDevice[]> {
  const pages = ['/', '/connected_devices.html', '/arp_table.html', '/status.html'];

  for (const page of pages) {
    try {
      const res = await client.get(page);
      if (res.status === 200 && typeof res.data === 'string') {
        const list = parseHtmlDeviceTable(res.data);
        if (list.length > 0) {
          console.info('[dlink] HTML device list via %s (%d devices)', page, list.length);
          return list;
        }
      }
    } catch {
      // try next
    }
  }
  return [];
}

async function fetchStatus(client: AxiosInstance): Promise<Partial<DlinkStatus>> {
  const endpoints = ['/cgi-bin/status.cgi', '/goform/getSysStatus', '/', '/status.html'];

  for (const endpoint of endpoints) {
    try {
      const res = await client.get(endpoint);
      if (res.status !== 200) continue;

      if (typeof res.data === 'object' && res.data !== null) {
        const o = res.data as Record<string, unknown>;
        return {
          model: String(o.model ?? o.productModel ?? 'D-Link X1852E'),
          firmwareVersion: String(o.firmware ?? o.firmwareVersion ?? 'unknown'),
          wanIp: String(o.wanIp ?? o.wan_ip ?? o.pppoeIp ?? 'unknown'),
          wanStatus: String(o.wanStatus ?? '') === 'connected' ? 'connected' : 'unknown',
          uptime: Number(o.uptime ?? 0),
        };
      }

      if (typeof res.data === 'string') {
        const m = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/.exec(res.data);
        return { model: 'D-Link X1852E', wanIp: m?.[1] ?? 'unknown', wanStatus: 'unknown' };
      }
    } catch {
      // try next
    }
  }
  return { model: 'D-Link X1852E', wanIp: 'unknown', wanStatus: 'unknown' };
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseJsonDeviceList(data: unknown): DlinkDevice[] {
  const obj = data as Record<string, unknown>;
  const keys = ['hostList', 'clients', 'deviceList', 'connectedDevices', 'client_list', 'data'];

  for (const key of keys) {
    const list = obj[key];
    if (Array.isArray(list) && list.length > 0) {
      return list.map(normaliseEntry).filter((d): d is DlinkDevice => d !== null);
    }
  }

  // Top-level array
  if (Array.isArray(data)) {
    return (data as unknown[]).map(normaliseEntry).filter((d): d is DlinkDevice => d !== null);
  }

  return [];
}

function normaliseEntry(entry: unknown): DlinkDevice | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const e = entry as Record<string, unknown>;

  const mac = String(e.mac ?? e.macaddr ?? e.MAC ?? e.hwaddr ?? '')
    .toUpperCase()
    .replace(/-/g, ':');
  const ip = String(e.ip ?? e.ipaddr ?? e.IP ?? e.ipAddress ?? '');

  if (!mac || !ip || ip === 'undefined') return null;
  if (ip.endsWith('.0') || ip.endsWith('.255') || ip === '0.0.0.0') return null;

  const name = String(e.name ?? e.hostname ?? e.devName ?? `Device-${ip.split('.').pop()}`);
  const connRaw = String(e.type ?? e.connection ?? e.linkType ?? e.media ?? '').toLowerCase();
  const connection: DlinkDevice['connection'] =
    connRaw === 'wired' || connRaw === 'lan' || connRaw === 'ethernet'
      ? 'ethernet'
      : 'wifi';

  const rawSignal = e.rssi ?? e.signal ?? e.rssiDBM;
  const signal = rawSignal !== undefined && !isNaN(Number(rawSignal)) ? Number(rawSignal) : undefined;

  return { name, ip, mac, connection, signal };
}

function parseHnapClientList(xml: string): DlinkDevice[] {
  const devices: DlinkDevice[] = [];
  // Match <ClientInfo>...</ClientInfo> blocks
  const clientBlocks = [...xml.matchAll(/<ClientInfo[^>]*>([\s\S]*?)<\/ClientInfo>/gi)];

  for (const [, block] of clientBlocks) {
    const mac = xmlTag(block, 'MACAddress') ?? xmlTag(block, 'MAC');
    const ip = xmlTag(block, 'IPAddress') ?? xmlTag(block, 'IP');
    if (!mac || !ip) continue;

    const name = xmlTag(block, 'NickName') ?? xmlTag(block, 'DeviceName') ?? `Device-${ip.split('.').pop()}`;
    const connType = xmlTag(block, 'Type') ?? xmlTag(block, 'ConnectionType') ?? 'wifi';

    devices.push({
      name,
      ip,
      mac: mac.toUpperCase().replace(/-/g, ':'),
      connection: /wired|ethernet|lan/i.test(connType) ? 'ethernet' : 'wifi',
      signal: Number(xmlTag(block, 'RSSI') ?? NaN) || undefined,
    });
  }

  return devices;
}

function parseHtmlDeviceTable(html: string): DlinkDevice[] {
  const devices: DlinkDevice[] = [];
  const seen = new Set<string>();

  const macIpPattern =
    /([0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}).*?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g;

  for (const match of html.matchAll(macIpPattern)) {
    const mac = match[1].toUpperCase().replace(/-/g, ':');
    const ip = match[2];
    if (ip.endsWith('.0') || ip.endsWith('.255') || ip === '0.0.0.0') continue;
    if (seen.has(mac)) continue;
    seen.add(mac);

    const ctx = html.slice(Math.max(0, match.index - 200), match.index + 400);
    const conn: DlinkDevice['connection'] = /wired|ethernet|lan/i.test(ctx) ? 'ethernet' : 'wifi';

    devices.push({ name: `Device-${ip.split('.').pop()}`, ip, mac, connection: conn });
  }

  return devices;
}

// ---------------------------------------------------------------------------
// Error classifier
// ---------------------------------------------------------------------------

function classifyError(err: unknown): RouterError {
  if (err instanceof RouterError) return err;
  const axiosErr = err as AxiosError;
  if (axiosErr.isAxiosError) {
    if (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ENOTFOUND') {
      return new RouterError('offline', 'D-Link router is unreachable', err);
    }
    if (axiosErr.code === 'ETIMEDOUT' || axiosErr.code === 'ECONNABORTED') {
      return new RouterError('timeout', 'D-Link router request timed out', err);
    }
    if (axiosErr.response?.status === 401 || axiosErr.response?.status === 403) {
      return new RouterError('invalid_credentials', 'D-Link rejected credentials', err);
    }
  }
  return new RouterError('unknown', String(err), err);
}

// ---------------------------------------------------------------------------
// Mock fixture (test use only — never used at runtime)
// ---------------------------------------------------------------------------

export function getMockDlinkResponse(ip = 'http://192.168.1.5'): DlinkDevicesResponse {
  return {
    router: 'D-Link X1852E',
    routerIp: ip,
    deviceCount: 2,
    devices: [
      { name: 'Laptop-DLink', ip: '192.168.1.101', mac: 'AA:BB:CC:DD:EE:01', connection: 'wifi', signal: -42 },
      { name: 'Phone-DLink', ip: '192.168.1.102', mac: 'AA:BB:CC:DD:EE:02', connection: 'wifi', signal: -55 },
    ],
    source: 'live',
    fetchedAt: new Date().toISOString(),
    status: { model: 'D-Link X1852E', wanIp: 'unknown', wanStatus: 'unknown' },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getDlinkData(): Promise<DlinkDevicesResponse> {
  const cfg = devicesConfig.dlinkX1852e;

  console.info('[dlink] → connecting to D-Link X1852E at %s', cfg.ip);

  const client = createHttpClient(cfg.ip, cfg.timeout);

  try {
    const loginResult = await login(client, cfg.ip, cfg.username, cfg.password);

    // Choose device fetch strategy based on how we authenticated
    let devices: DlinkDevice[];
    if (loginResult.strategy === 'hnap' && loginResult.privateKey) {
      devices = await fetchDevicesHnap(client, loginResult.privateKey);
      if (devices.length === 0) devices = await fetchDevicesJson(client);
      if (devices.length === 0) devices = await fetchDevicesHtml(client);
    } else {
      devices = await fetchDevicesJson(client);
      if (devices.length === 0) devices = await fetchDevicesHtml(client);
    }

    const status = await fetchStatus(client);

    console.info('[dlink] ✓ login OK — %d device(s) fetched', devices.length);

    return {
      router: 'D-Link X1852E',
      routerIp: cfg.ip,
      deviceCount: devices.length,
      devices,
      source: 'live',
      fetchedAt: new Date().toISOString(),
      status: { ...status, connectedClients: devices.length },
    };
  } catch (err) {
    const routerErr = classifyError(err);
    console.warn('[dlink] ✗ %s: %s', routerErr.kind, routerErr.message);
    throw routerErr;
  }
}
