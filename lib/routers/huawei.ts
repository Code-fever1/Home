/**
 * Huawei HG8245W5 router service — SERVER SIDE ONLY.
 *
 * Login flow:
 *   1. POST credentials to the router admin panel.
 *   2. Capture the Set-Cookie header and store it in a shared cookie jar.
 *   3. All subsequent requests carry the session cookie automatically.
 *
 * All functions throw typed RouterError on failure so callers can decide
 * whether to surface the error or fall back to mock data.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { CookieJar } from 'tough-cookie';
import { routerConfig } from '@/lib/config';

// ---------------------------------------------------------------------------
// Types
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

export interface RouterDevice {
  name: string;
  ip: string;
  mac: string;
  connection: 'wifi' | 'ethernet' | 'unknown';
  signal?: number;
  leaseTime?: string;
}

export interface RouterStatus {
  model: string;
  firmwareVersion: string;
  uptime: number;
  wanIp: string;
  wanStatus: 'connected' | 'disconnected' | 'unknown';
  cpuUsage: number;
  memoryUsage: number;
  ssid?: string;
  ssid5g?: string;
  connectedClients: number;
}

export interface DevicesResponse {
  router: string;
  deviceCount: number;
  devices: RouterDevice[];
  source: 'live' | 'mock';
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Internal HTTP client with cookie jar
// ---------------------------------------------------------------------------

/** Build an Axios instance that persists cookies between requests. */
function createHttpClient(baseURL: string, timeout: number): AxiosInstance {
  const jar = new CookieJar();

  const client = axios.create({
    baseURL,
    timeout,
    withCredentials: true,
    maxRedirects: 5,
    validateStatus: (status) => status < 500, // don't throw on 4xx by default
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/json,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
  });

  // Attach cookie jar to every request
  client.interceptors.request.use(async (config) => {
    const url = `${config.baseURL ?? ''}${config.url ?? ''}`;
    const cookieHeader = await jar.getCookieString(url).catch(() => '');
    if (cookieHeader) {
      config.headers = config.headers ?? {};
      config.headers['Cookie'] = cookieHeader;
    }
    return config;
  });

  // Persist Set-Cookie headers from every response
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
 * Attempt to authenticate with the router.
 * The HG8245W5 firmware accepts a form POST on the root URL.
 * Some firmware revisions also respond to /login.html.
 */
async function login(client: AxiosInstance, username: string, password: string): Promise<void> {
  const loginEndpoints = ['/', '/login.html', '/login.cgi'];

  let lastError: unknown;

  for (const endpoint of loginEndpoints) {
    try {
      const params = new URLSearchParams();
      params.append('UserName', username);
      params.append('PassWord', password);
      params.append('Language', 'english');

      const response = await client.post(endpoint, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: `${routerConfig.huawei.ip}${endpoint}`,
        },
      });

      // Successful login: router returns 200 or redirects (3xx)
      // A 401/403 or a page that still contains "login" strongly indicates failure
      const body: string = typeof response.data === 'string' ? response.data : '';
      const isRejected =
        response.status === 401 ||
        response.status === 403 ||
        /incorrect|invalid|error|login/i.test(body.slice(0, 500)) ||
        body.toLowerCase().includes('username') && !body.toLowerCase().includes('logout');

      if (!isRejected || response.status < 400) {
        return; // login accepted
      }

      lastError = new RouterError(
        'invalid_credentials',
        `Router rejected credentials (status ${response.status})`
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

/**
 * Fetch the list of connected LAN/WiFi clients.
 * The HG8245W5 exposes DHCP/ARP tables at several known paths.
 */
async function fetchDevices(client: AxiosInstance): Promise<RouterDevice[]> {
  // Endpoints known to carry host tables on Huawei HG8245 series firmwares
  const candidateEndpoints = [
    '/html/bbsp/dhcp/dhcp.asp',
    '/html/bbsp/wlanratedynamic/wlanratedynamic.asp',
    '/html/bbsp/arplist/arplist.asp',
    '/cgi-bin/config.exp',
    '/userRpm/StatusClientsRpm.htm',
  ];

  for (const endpoint of candidateEndpoints) {
    try {
      const response = await client.get(endpoint);
      if (response.status === 200 && typeof response.data === 'string') {
        const parsed = parseDeviceTable(response.data);
        if (parsed.length > 0) return parsed;
      }
    } catch {
      // Try next endpoint
    }
  }

  // Fallback: scrape ARP/DHCP from the main status page
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

/**
 * Fetch high-level router status (WAN, CPU, memory, uptime…).
 */
async function fetchStatus(client: AxiosInstance): Promise<Partial<RouterStatus>> {
  const statusEndpoints = [
    '/html/bbsp/wan/wan.asp',
    '/html/bbsp/common/status.asp',
    '/statusRpm.htm',
    '/',
  ];

  for (const endpoint of statusEndpoints) {
    try {
      const response = await client.get(endpoint);
      if (response.status === 200 && typeof response.data === 'string') {
        return parseStatusPage(response.data);
      }
    } catch {
      // Try next
    }
  }

  return {};
}

// ---------------------------------------------------------------------------
// HTML parsers (regex-based, firmware-agnostic)
// ---------------------------------------------------------------------------

/** Extract device rows from any page that embeds ARP/DHCP table data. */
function parseDeviceTable(html: string): RouterDevice[] {
  const devices: RouterDevice[] = [];
  const seen = new Set<string>();

  // Pattern 1 — MAC + IP pairs anywhere in HTML/JS
  const macIpPattern =
    /([0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}).*?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g;

  let match: RegExpExecArray | null;
  while ((match = macIpPattern.exec(html)) !== null) {
    const mac = normaliseMac(match[1]);
    const ip = match[2];

    // Skip gateway / broadcast addresses
    if (ip.endsWith('.0') || ip.endsWith('.255') || ip === '0.0.0.0') continue;
    if (seen.has(mac)) continue;
    seen.add(mac);

    devices.push({
      name: guessName(html, mac, ip),
      ip,
      mac,
      connection: guessConnectionType(html, mac),
      signal: guessSignalStrength(html, mac),
    });
  }

  // Pattern 2 — JSON arrays sometimes embedded in <script> blocks
  const jsonPattern = /\[\s*\{[^}]*"mac"[^}]*\}/g;
  const jsonMatches = html.match(jsonPattern);
  if (jsonMatches) {
    for (const fragment of jsonMatches) {
      try {
        const arr: Array<{ mac: string; ip: string; name?: string; type?: string }> =
          JSON.parse(fragment + ']');
        for (const entry of arr) {
          if (!entry.mac || !entry.ip) continue;
          const mac = normaliseMac(entry.mac);
          if (seen.has(mac)) continue;
          seen.add(mac);
          devices.push({
            name: entry.name ?? `Device-${mac.slice(-5)}`,
            ip: entry.ip,
            mac,
            connection: entry.type === 'wifi' ? 'wifi' : 'ethernet',
          });
        }
      } catch {
        // ignore malformed JSON
      }
    }
  }

  return devices;
}

function parseStatusPage(html: string): Partial<RouterStatus> {
  const extract = (pattern: RegExp): string | undefined =>
    pattern.exec(html)?.[1]?.trim();

  const wanIp =
    extract(/WAN\s*IP[^>]*>[^>]*>([\d.]+)/) ??
    extract(/ip[Aa]ddress['":\s]+([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);

  const firmware = extract(/[Ff]irmware[^>]*>[^>]*>([V\d.A-Za-z]+)/);
  const uptime = extract(/[Uu]ptime[^>]*>[^>]*>([^<]+)/);

  return {
    model: 'Huawei HG8245W5',
    wanIp: wanIp ?? 'unknown',
    wanStatus: wanIp ? 'connected' : 'unknown',
    firmwareVersion: firmware ?? 'unknown',
    uptime: parseUptimeSeconds(uptime ?? ''),
    cpuUsage: 0,
    memoryUsage: 0,
    connectedClients: 0,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normaliseMac(mac: string): string {
  return mac.replace(/-/g, ':').toUpperCase();
}

function guessName(html: string, mac: string, ip: string): string {
  // Try to find a hostname near the MAC address
  const macEscaped = mac.replace(/:/g, '[:\\-]');
  const hostnamePattern = new RegExp(
    macEscaped + '[^\\n]{0,200}?([A-Za-z][A-Za-z0-9\\-_]{2,30})',
    'i'
  );
  const match = hostnamePattern.exec(html);
  if (match?.[1] && !/^(td|tr|div|span|table|html|body|head)$/i.test(match[1])) {
    return match[1];
  }
  return `Device-${ip.split('.').pop()}`;
}

function guessConnectionType(html: string, mac: string): 'wifi' | 'ethernet' {
  const macEscaped = mac.replace(/:/g, '[:\\-]');
  const context = new RegExp(macEscaped + '[^\\n]{0,300}', 'i').exec(html)?.[0] ?? '';
  return /wifi|wireless|wlan|ssid/i.test(context) ? 'wifi' : 'ethernet';
}

function guessSignalStrength(html: string, mac: string): number | undefined {
  const macEscaped = mac.replace(/:/g, '[:\\-]');
  const context = new RegExp(macEscaped + '[^\\n]{0,300}', 'i').exec(html)?.[0] ?? '';
  const rssiMatch = /(-\d{2,3})\s*dBm/i.exec(context);
  if (rssiMatch) return Number(rssiMatch[1]);
  return undefined;
}

function parseUptimeSeconds(text: string): number {
  if (!text) return 0;
  let seconds = 0;
  const days = /(\d+)\s*day/i.exec(text);
  const hours = /(\d+)\s*hour/i.exec(text);
  const minutes = /(\d+)\s*min/i.exec(text);
  if (days) seconds += Number(days[1]) * 86400;
  if (hours) seconds += Number(hours[1]) * 3600;
  if (minutes) seconds += Number(minutes[1]) * 60;
  return seconds;
}

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

export function getMockDevicesResponse(): DevicesResponse {
  return {
    router: 'Huawei HG8245W5',
    deviceCount: 6,
    source: 'mock',
    fetchedAt: new Date().toISOString(),
    devices: [
      { name: 'AliJah-Laptop', ip: '100.10.10.15', mac: 'AC:12:34:55:AA:22', connection: 'wifi', signal: -55 },
      { name: 'iPhone-Home', ip: '100.10.10.20', mac: 'B4:F1:DA:1F:3A:01', connection: 'wifi', signal: -62 },
      { name: 'Smart-TV', ip: '100.10.10.25', mac: '00:E0:91:B4:20:11', connection: 'wifi', signal: -70 },
      { name: 'Desktop-PC', ip: '100.10.10.30', mac: '30:9C:23:E4:AA:07', connection: 'ethernet' },
      { name: 'iPad-Pro', ip: '100.10.10.35', mac: 'A4:83:E7:2C:55:F1', connection: 'wifi', signal: -58 },
      { name: 'Printer', ip: '100.10.10.40', mac: '18:A9:05:C0:1B:2D', connection: 'ethernet' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log in to the router and return connected devices.
 * Falls back to mock data on any error — the `source` field tells callers
 * whether the data is live or synthetic.
 */
export async function getConnectedDevices(): Promise<DevicesResponse> {
  const { ip, username, password, timeout } = routerConfig.huawei;

  console.info('[huawei] → connecting to %s', ip);
  const client = createHttpClient(ip, timeout);

  try {
    console.info('[huawei] attempting login…');
    await login(client, username, password);
    console.info('[huawei] login OK — fetching device list…');

    const [devices, status] = await Promise.all([
      fetchDevices(client),
      fetchStatus(client),
    ]);

    console.info('[huawei] ✓ %d device(s) fetched (WAN: %s)', devices.length, status.wanIp ?? 'unknown');

    return {
      router: 'Huawei HG8245W5',
      deviceCount: devices.length,
      devices,
      source: 'live',
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    const routerErr = classifyError(err);
    console.warn('[huawei] ✗ %s: %s', routerErr.kind, routerErr.message);
    throw routerErr;
  }
}

/**
 * Retrieve high-level router status only.
 */
export async function getRouterStatus(): Promise<RouterStatus> {
  const { ip, username, password, timeout } = routerConfig.huawei;
  const client = createHttpClient(ip, timeout);

  await login(client, username, password);
  const partial = await fetchStatus(client);
  const devices = await fetchDevices(client);

  return {
    model: 'Huawei HG8245W5',
    firmwareVersion: partial.firmwareVersion ?? 'unknown',
    uptime: partial.uptime ?? 0,
    wanIp: partial.wanIp ?? 'unknown',
    wanStatus: partial.wanStatus ?? 'unknown',
    cpuUsage: partial.cpuUsage ?? 0,
    memoryUsage: partial.memoryUsage ?? 0,
    ssid: partial.ssid,
    ssid5g: partial.ssid5g,
    connectedClients: devices.length,
  };
}

/**
 * Alias: fetch WiFi clients specifically.
 */
export async function getWifiClients(): Promise<RouterDevice[]> {
  const all = await getConnectedDevices();
  return all.devices.filter((d) => d.connection === 'wifi');
}
