/**
 * Tenda router service (N301 + F3) — SERVER SIDE ONLY.
 *
 * Both the N301 and F3 share the same Tenda firmware web-UI structure.
 * Login is a form POST that returns a session cookie; all subsequent
 * requests carry that cookie automatically via a tough-cookie jar.
 *
 * The same service is instantiated twice (once for each router) using
 * the factory function `createTendaService`.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { CookieJar } from 'tough-cookie';
import { devicesConfig } from '@/lib/config';

// ---------------------------------------------------------------------------
// Re-export shared error types (mirrors huawei.ts for type compatibility)
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
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'RouterError';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TendaDevice {
  name: string;
  ip: string;
  mac: string;
  connection: 'wifi' | 'ethernet' | 'unknown';
  signal?: number;
}

export interface TendaStatus {
  model: string;
  firmwareVersion: string;
  uptime: number;
  wanIp: string;
  wanStatus: 'connected' | 'disconnected' | 'unknown';
  ssid?: string;
  connectedClients: number;
}

export interface TendaDevicesResponse {
  router: string;
  routerIp: string;
  deviceCount: number;
  devices: TendaDevice[];
  status: Partial<TendaStatus>;
  source: 'live' | 'mock';
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// HTTP client with cookie jar
// ---------------------------------------------------------------------------

function createHttpClient(baseURL: string, timeout: number): AxiosInstance {
  const jar = new CookieJar();

  const client = axios.create({
    baseURL,
    timeout,
    withCredentials: true,
    maxRedirects: 5,
    validateStatus: (status) => status < 500,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/json,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
  });

  client.interceptors.request.use(async (config) => {
    const url = `${config.baseURL ?? ''}${config.url ?? ''}`;
    const cookieHeader = await jar.getCookieString(url).catch(() => '');
    if (cookieHeader) {
      config.headers = config.headers ?? {};
      config.headers['Cookie'] = cookieHeader;
    }
    return config;
  });

  client.interceptors.response.use(async (response) => {
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      const requestUrl = `${response.config.baseURL ?? ''}${response.config.url ?? ''}`;
      for (const cookie of setCookie) {
        await jar.setCookie(cookie, requestUrl).catch(() => {});
      }
    }
    return response;
  });

  return client;
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

/**
 * Tenda N301/F3 login endpoints.
 * Most Tenda firmware accepts a JSON POST or form POST on /login/Auth.
 * Older firmware uses the root / or /goform/SysToolRestoreSet as auth gate.
 */
async function login(
  client: AxiosInstance,
  baseURL: string,
  username: string,
  password: string
): Promise<void> {
  const loginEndpoints = [
    { path: '/login/Auth', body: JSON.stringify({ username, password }), contentType: 'application/json' },
    { path: '/goform/SysToolRestoreSet', body: `user=${encodeURIComponent(username)}&pwd=${encodeURIComponent(password)}`, contentType: 'application/x-www-form-urlencoded' },
    { path: '/', body: `user=${encodeURIComponent(username)}&pwd=${encodeURIComponent(password)}`, contentType: 'application/x-www-form-urlencoded' },
  ];

  let lastError: unknown;

  for (const { path, body, contentType } of loginEndpoints) {
    try {
      const response = await client.post(path, body, {
        headers: {
          'Content-Type': contentType,
          Referer: `${baseURL}/`,
        },
      });

      const bodyStr: string =
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data ?? '');

      // Tenda returns {"Result":0} or {"errCode":0} on success
      const jsonData = typeof response.data === 'object' ? response.data : null;
      const isJsonSuccess =
        jsonData &&
        (jsonData.Result === 0 ||
          jsonData.errCode === 0 ||
          jsonData.status === 'success');

      const isHtmlRejection =
        response.status === 401 ||
        response.status === 403 ||
        /incorrect|invalid|failed|error/i.test(bodyStr.slice(0, 300));

      if (isJsonSuccess || (!isHtmlRejection && response.status < 400)) {
        return;
      }

      lastError = new RouterError(
        'invalid_credentials',
        `Tenda rejected credentials at ${path} (status ${response.status})`
      );
    } catch (err) {
      lastError = err;
    }
  }

  throw classifyError(lastError);
}

// ---------------------------------------------------------------------------
// Device list
// ---------------------------------------------------------------------------

/** Endpoints that carry connected host lists on Tenda N301/F3 firmware. */
async function fetchDevices(client: AxiosInstance): Promise<TendaDevice[]> {
  const candidateEndpoints = [
    '/goform/getWifiBasicInfo',
    '/goform/GetParentControlInfo',
    '/goform/WifiBasicSet',
    '/goform/GetOnlineDevInfo',
    '/goform/getOnlineDevInfo',
    '/goform/HostInfo',
    '/goform/net_client_list_ipv4',
  ];

  for (const endpoint of candidateEndpoints) {
    try {
      const response = await client.get(endpoint);
      if (response.status === 200) {
        const parsed = parseDeviceResponse(response.data, endpoint);
        if (parsed.length > 0) return parsed;
      }
    } catch {
      // Try next
    }
  }

  // Fallback: scrape from main homepage
  try {
    const response = await client.get('/');
    if (response.status === 200 && typeof response.data === 'string') {
      return parseDeviceTable(response.data);
    }
  } catch {
    // ignore
  }

  return [];
}

// ---------------------------------------------------------------------------
// Router status
// ---------------------------------------------------------------------------

async function fetchStatus(client: AxiosInstance): Promise<Partial<TendaStatus>> {
  const statusEndpoints = [
    '/goform/SysStatus',
    '/goform/getWanInfo',
    '/goform/GetStatusInfo',
    '/',
  ];

  for (const endpoint of statusEndpoints) {
    try {
      const response = await client.get(endpoint);
      if (response.status === 200) {
        return parseStatusResponse(response.data);
      }
    } catch {
      // Try next
    }
  }
  return {};
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseDeviceResponse(data: unknown, _endpoint: string): TendaDevice[] {
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;

    // Pattern: { hostList: [...] } or { deviceList: [...] } or { onlineList: [...] }
    const arrayKeys = ['hostList', 'deviceList', 'onlineList', 'client_list', 'clients'];
    for (const key of arrayKeys) {
      const list = obj[key];
      if (Array.isArray(list) && list.length > 0) {
        return list.map(normaliseEntry).filter(Boolean) as TendaDevice[];
      }
    }

    // Pattern: top-level object is a single device map keyed by MAC
    const entries = Object.values(obj);
    if (entries.length > 0 && typeof entries[0] === 'object') {
      return entries.map(normaliseEntry).filter(Boolean) as TendaDevice[];
    }
  }

  if (typeof data === 'string') {
    return parseDeviceTable(data);
  }

  return [];
}

function normaliseEntry(entry: unknown): TendaDevice | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const e = entry as Record<string, unknown>;

  const mac =
    String(e.mac ?? e.macaddr ?? e.MAC ?? e.hwaddr ?? '').toUpperCase().replace(/-/g, ':');
  const ip = String(e.ip ?? e.ipaddr ?? e.IP ?? e.ipAddress ?? '');

  if (!mac || !ip || ip === 'undefined') return null;
  if (ip.endsWith('.0') || ip.endsWith('.255') || ip === '0.0.0.0') return null;

  const name = String(e.name ?? e.hostname ?? e.devName ?? `Device-${ip.split('.').pop()}`);
  const connRaw = String(e.type ?? e.connection ?? e.linkType ?? '').toLowerCase();
  const connection: TendaDevice['connection'] =
    connRaw.includes('wire') || connRaw === 'lan'
      ? 'ethernet'
      : connRaw.includes('wire') === false && connRaw.includes('wifi')
      ? 'wifi'
      : 'wifi'; // Tenda defaults to WiFi clients

  const signal = e.rssi !== undefined ? Number(e.rssi) : e.signal !== undefined ? Number(e.signal) : undefined;

  return { name, ip, mac, connection, signal: signal !== undefined && !isNaN(signal) ? signal : undefined };
}

function parseDeviceTable(html: string): TendaDevice[] {
  const devices: TendaDevice[] = [];
  const seen = new Set<string>();

  const macIpPattern =
    /([0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}).*?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g;

  let match: RegExpExecArray | null;
  while ((match = macIpPattern.exec(html)) !== null) {
    const mac = match[1].toUpperCase().replace(/-/g, ':');
    const ip = match[2];
    if (ip.endsWith('.0') || ip.endsWith('.255') || ip === '0.0.0.0') continue;
    if (seen.has(mac)) continue;
    seen.add(mac);
    devices.push({ name: `Device-${ip.split('.').pop()}`, ip, mac, connection: 'wifi' });
  }

  return devices;
}

function parseStatusResponse(data: unknown): Partial<TendaStatus> {
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    return {
      wanIp: String(obj.wanIp ?? obj.wan_ip ?? obj.pppoeIp ?? 'unknown'),
      wanStatus: obj.wanStatus === 'connected' || obj.pppoeStatus === 'pppoe_connected'
        ? 'connected'
        : 'unknown',
      ssid: obj.ssid ? String(obj.ssid) : undefined,
      firmwareVersion: obj.version ? String(obj.version) : 'unknown',
      uptime: Number(obj.uptime ?? 0),
      connectedClients: 0,
    };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Error classifier
// ---------------------------------------------------------------------------

function classifyError(err: unknown): RouterError {
  if (err instanceof RouterError) return err;
  const axiosErr = err as AxiosError;
  if (axiosErr.isAxiosError) {
    if (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ENOTFOUND') {
      return new RouterError('offline', 'Router is unreachable', err);
    }
    if (axiosErr.code === 'ETIMEDOUT' || axiosErr.code === 'ECONNABORTED') {
      return new RouterError('timeout', 'Request to router timed out', err);
    }
    if (axiosErr.response?.status === 401 || axiosErr.response?.status === 403) {
      return new RouterError('invalid_credentials', 'Invalid router credentials', err);
    }
  }
  return new RouterError('unknown', String(err), err);
}

// ---------------------------------------------------------------------------
// Mock fallback data
// ---------------------------------------------------------------------------

export function getMockTendaResponse(model: 'N301' | 'F3', ip: string): TendaDevicesResponse {
  const baseOctet = model === 'N301' ? 10 : 20;
  return {
    router: `Tenda ${model}`,
    routerIp: ip,
    deviceCount: model === 'N301' ? 3 : 2,
    source: 'mock',
    fetchedAt: new Date().toISOString(),
    status: { model: `Tenda ${model}`, wanIp: ip, wanStatus: 'unknown', connectedClients: model === 'N301' ? 3 : 2 },
    devices: [
      { name: `Phone-${model}`, ip: `192.168.1.${baseOctet + 1}`, mac: `BB:CC:DD:EE:FF:${(baseOctet + 1).toString(16).padStart(2, '0').toUpperCase()}`, connection: 'wifi', signal: -60 },
      { name: `Tablet-${model}`, ip: `192.168.1.${baseOctet + 2}`, mac: `BB:CC:DD:EE:FF:${(baseOctet + 2).toString(16).padStart(2, '0').toUpperCase()}`, connection: 'wifi', signal: -65 },
      ...(model === 'N301'
        ? [{ name: `Laptop-${model}`, ip: `192.168.1.${baseOctet + 3}`, mac: `BB:CC:DD:EE:FF:${(baseOctet + 3).toString(16).padStart(2, '0').toUpperCase()}`, connection: 'wifi' as const, signal: -70 }]
        : []),
    ],
  };
}

// ---------------------------------------------------------------------------
// Factory — creates a scoped service for a specific Tenda router
// ---------------------------------------------------------------------------

interface TendaConfig {
  ip: string;
  username: string;
  password: string;
  timeout: number;
  model: 'N301' | 'F3';
}

async function runTendaService(cfg: TendaConfig): Promise<TendaDevicesResponse> {
  console.info('[tenda-%s] → connecting to %s', cfg.model, cfg.ip);
  const client = createHttpClient(cfg.ip, cfg.timeout);

  try {
    console.info('[tenda-%s] attempting login…', cfg.model);
    await login(client, cfg.ip, cfg.username, cfg.password);
    console.info('[tenda-%s] login OK — fetching device list…', cfg.model);

    const [devices, status] = await Promise.all([
      fetchDevices(client),
      fetchStatus(client),
    ]);

    console.info('[tenda-%s] ✓ %d device(s) fetched (WAN: %s)', cfg.model, devices.length, status.wanIp ?? 'unknown');

    return {
      router: `Tenda ${cfg.model}`,
      routerIp: cfg.ip,
      deviceCount: devices.length,
      devices,
      status: { ...status, model: `Tenda ${cfg.model}`, connectedClients: devices.length },
      source: 'live',
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    const routerErr = classifyError(err);
    console.warn('[tenda-%s] ✗ %s: %s', cfg.model, routerErr.kind, routerErr.message);
    throw routerErr;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetch data from the Tenda N301 */
export async function getTendaN301Data(): Promise<TendaDevicesResponse> {
  const cfg = devicesConfig.tendaN301;
  return runTendaService({ ip: cfg.ip, username: cfg.username, password: cfg.password, timeout: cfg.timeout, model: 'N301' });
}

/** Fetch data from the Tenda F3 */
export async function getTendaF3Data(): Promise<TendaDevicesResponse> {
  const cfg = devicesConfig.tendaF3;
  return runTendaService({ ip: cfg.ip, username: cfg.username, password: cfg.password, timeout: cfg.timeout, model: 'F3' });
}
