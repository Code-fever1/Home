import axios, { AxiosError, AxiosInstance } from 'axios';
import { CookieJar } from 'tough-cookie';
import { routerConfig } from '@/lib/config';

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

export interface HuaweiDevice {
  name: string;
  ip: string;
  mac: string;
  connection: 'wifi' | 'ethernet' | 'unknown';
  signal?: number;
  leaseTime?: string;
}

export interface HuaweiDevicesResponse {
  router: string;
  routerIP: string;
  deviceCount: number;
  devices: HuaweiDevice[];
  source: 'live';
  fetchedAt: string;
}

export type RouterDevice = HuaweiDevice;
export type DevicesResponse = HuaweiDevicesResponse;

interface HuaweiSession {
  client: AxiosInstance;
  routerIP: string;
  username: string;
}

interface LanDeviceEntry {
  ip: string;
  mac: string;
  status: string;
  port: string;
  portType: string;
  hostname: string;
  alias: string;
  devType: string;
  leaseSeconds?: number;
  ipv4Enabled?: boolean;
}

interface DhcpDeviceEntry {
  ip: string;
  mac: string;
  name: string;
  devType: string;
  interfaceType: string;
  addressSource: string;
  leaseSeconds?: number;
}

const ROUTER_NAME = 'Huawei HG8245W5';
const LOGIN_LANGUAGE = 'english';
const RETRYABLE_CODES = new Set(['ECONNRESET', 'EPIPE', 'ECONNABORTED', 'ETIMEDOUT']);

function createHttpClient(baseURL: string, timeout: number): AxiosInstance {
  const jar = new CookieJar();
  const client = axios.create({
    baseURL,
    timeout,
    maxRedirects: 5,
    validateStatus: (status) => status < 500,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });

  client.interceptors.request.use(async (config) => {
    const url = `${config.baseURL ?? ''}${config.url ?? ''}`;
    const jarCookie = await jar.getCookieString(url).catch(() => '');
    if (jarCookie) {
      const currentCookieHeader =
        (typeof config.headers?.Cookie === 'string' && config.headers.Cookie) ||
        (typeof config.headers?.cookie === 'string' && config.headers.cookie) ||
        '';

      const mergedCookie = currentCookieHeader
        ? `${currentCookieHeader}; ${jarCookie}`
        : jarCookie;

      config.headers = config.headers ?? {};
      config.headers.Cookie = mergedCookie;
    }

    return config;
  });

  client.interceptors.response.use(async (response) => {
    const setCookie = response.headers['set-cookie'];
    if (Array.isArray(setCookie) && setCookie.length > 0) {
      const url = `${response.config.baseURL ?? ''}${response.config.url ?? ''}`;
      for (const cookie of setCookie) {
        await jar.setCookie(cookie, url).catch(() => undefined);
      }
    }
    return response;
  });

  return client;
}

function cleanRouterString(value: string): string {
  return value.replace(/^\uFEFF/, '').replace(/^ï»¿/, '').trim();
}

function toResponseString(data: unknown): string {
  if (typeof data === 'string') return cleanRouterString(data);
  if (data === null || data === undefined) return '';
  if (typeof data === 'object') return cleanRouterString(JSON.stringify(data));
  return cleanRouterString(String(data));
}

function stripProtocol(ip: string): string {
  return ip.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function isWaitingPage(body: string): boolean {
  return /<title>\s*Waiting\.\.\.\s*<\/title>/i.test(body) || /top\.location\.replace\(/i.test(body);
}

function isLoginPage(body: string): boolean {
  return /LoginSubmit|txt_Username|txt_Password|loginbutton/i.test(body);
}

function sanitiseToken(rawToken: string): string {
  const tokenMatch = cleanRouterString(rawToken).match(/[A-Fa-f0-9]{16,64}/);
  if (!tokenMatch) {
    throw new RouterError('login_failed', 'Router token was not returned by /asp/GetRandCount.asp');
  }
  return tokenMatch[0];
}

function encodePassword(password: string): string {
  return Buffer.from(password, 'utf8').toString('base64');
}

function normaliseMac(mac: string): string {
  return mac.replace(/-/g, ':').toUpperCase();
}

function isValidIp(ip: string): boolean {
  if (!ip || ip === '--' || ip === '0.0.0.0') return false;
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return false;
  }
  return !ip.endsWith('.0') && !ip.endsWith('.255');
}

function parseLeaseTime(seconds?: number): string | undefined {
  if (!seconds || Number.isNaN(seconds) || seconds <= 0) return undefined;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

function isRetryableNetworkError(err: unknown): boolean {
  const axiosErr = err as AxiosError;
  return Boolean(axiosErr?.isAxiosError && axiosErr.code && RETRYABLE_CODES.has(axiosErr.code));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(operationName: string, op: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await op();
    } catch (err) {
      lastError = err;
      if (!isRetryableNetworkError(err) || attempt >= attempts) {
        throw err;
      }
      const code = (err as AxiosError).code ?? 'unknown';
      console.warn('[huawei] %s retry %d/%d after %s', operationName, attempt, attempts, code);
      await delay(120 * attempt);
    }
  }
  throw lastError;
}

function decodeJsEscapes(value: string): string {
  return value
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim();
}

function extractQuotedArgs(content: string): string[] {
  const args: string[] = [];
  const pattern = /"((?:\\.|[^"\\])*)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    args.push(decodeJsEscapes(match[1]));
  }
  return args;
}

function parseLanUserDeviceScript(body: string): LanDeviceEntry[] {
  const entries: LanDeviceEntry[] = [];
  const pattern = /new\s+USERDevice\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(body)) !== null) {
    const args = extractQuotedArgs(match[1]);
    if (args.length < 16) continue;

    const ip = args[1];
    const mac = normaliseMac(args[2]);
    if (!isValidIp(ip) || !mac) continue;

    const leaseSeconds = Number(args[15]);
    entries.push({
      ip,
      mac,
      status: args[6] ?? '',
      port: args[3] ?? '',
      portType: args[7] ?? '',
      hostname: args[9] ?? '',
      alias: args[13] ?? '',
      devType: args[5] ?? '',
      leaseSeconds: Number.isFinite(leaseSeconds) ? leaseSeconds : undefined,
      ipv4Enabled: args[10] === '1',
    });
  }

  return entries;
}

function parseLegacyLanArray(body: string): LanDeviceEntry[] {
  const entries: LanDeviceEntry[] = [];
  const rowPattern = /DevInfoArry\s*\[\d+\]\s*=\s*["']([^"']+)["']/gi;
  let row: RegExpExecArray | null;

  while ((row = rowPattern.exec(body)) !== null) {
    const raw = row[1];
    const parts = raw.includes('/') ? raw.split('/') : raw.split('$');
    if (parts.length < 3) continue;

    const mac = normaliseMac(parts[0].trim());
    const ip = parts[1].trim();
    if (!isValidIp(ip) || !mac) continue;

    const connectionField = parts[2]?.trim() ?? '';
    entries.push({
      ip,
      mac,
      status: 'Online',
      port: connectionField === '0' ? 'LAN' : 'SSID',
      portType: connectionField === '0' ? 'ETH' : 'WIFI',
      hostname: parts[4]?.trim() ?? '',
      alias: '',
      devType: parts[4]?.trim() ?? '',
    });
  }

  return entries;
}

function parseDhcpScript(body: string): DhcpDeviceEntry[] {
  const entries: DhcpDeviceEntry[] = [];
  const pattern = /new\s+DHCPInfo\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(body)) !== null) {
    const args = extractQuotedArgs(match[1]);
    if (args.length < 8) continue;

    const ip = args[2];
    const mac = normaliseMac(args[3]);
    if (!isValidIp(ip) || !mac) continue;

    const leaseSeconds = Number(args[4]);
    entries.push({
      ip,
      mac,
      name: args[1] ?? '',
      devType: args[5] ?? '',
      interfaceType: args[6] ?? '',
      addressSource: args[7] ?? '',
      leaseSeconds: Number.isFinite(leaseSeconds) ? leaseSeconds : undefined,
    });
  }

  return entries;
}

function parseLegacyDhcpArray(body: string): DhcpDeviceEntry[] {
  const entries: DhcpDeviceEntry[] = [];
  const rowPattern = /DhcpInfoArry\s*\[\d+\]\s*=\s*["']([^"']+)["']/gi;
  let row: RegExpExecArray | null;

  while ((row = rowPattern.exec(body)) !== null) {
    const raw = row[1];
    const parts = raw.includes('/') ? raw.split('/') : raw.split('$');
    if (parts.length < 4) continue;

    const mac = normaliseMac(parts[0].trim());
    const ip = parts[1].trim();
    if (!isValidIp(ip) || !mac) continue;

    const leaseSeconds = Number(parts[3]);
    entries.push({
      ip,
      mac,
      name: parts[2]?.trim() ?? '',
      devType: '',
      interfaceType: '',
      addressSource: '',
      leaseSeconds: Number.isFinite(leaseSeconds) ? leaseSeconds : undefined,
    });
  }

  return entries;
}

function inferConnection(lan?: LanDeviceEntry, dhcp?: DhcpDeviceEntry): HuaweiDevice['connection'] {
  const samples = [lan?.portType ?? '', lan?.port ?? '', dhcp?.interfaceType ?? ''].join(' ');
  if (/wifi|wlan|ssid|802\.11/i.test(samples)) return 'wifi';
  if (/eth|lan|ethernet/i.test(samples)) return 'ethernet';
  return 'unknown';
}

function pickName(lan: LanDeviceEntry, dhcp?: DhcpDeviceEntry): string {
  const candidates = [lan.alias, lan.hostname, dhcp?.name ?? '', lan.devType, dhcp?.devType ?? ''];
  for (const candidate of candidates) {
    const value = candidate.trim();
    if (!value || value === '--' || value === '0') continue;
    return value;
  }
  return `Device-${lan.ip.split('.').pop()}`;
}

function mergeDevices(lanEntries: LanDeviceEntry[], dhcpEntries: DhcpDeviceEntry[]): HuaweiDevice[] {
  const dhcpByMac = new Map<string, DhcpDeviceEntry>();
  const dhcpByIp = new Map<string, DhcpDeviceEntry>();
  for (const dhcp of dhcpEntries) {
    dhcpByMac.set(dhcp.mac, dhcp);
    dhcpByIp.set(dhcp.ip, dhcp);
  }

  const devices: HuaweiDevice[] = [];
  const seen = new Set<string>();

  for (const lan of lanEntries) {
    if (!lan.ipv4Enabled && lan.ipv4Enabled !== undefined) continue;
    if (!/online/i.test(lan.status || '')) continue;

    const dhcp = dhcpByMac.get(lan.mac) ?? dhcpByIp.get(lan.ip);
    const mac = normaliseMac(lan.mac);
    if (seen.has(mac)) continue;
    seen.add(mac);

    const leaseTime = parseLeaseTime(lan.leaseSeconds ?? dhcp?.leaseSeconds);
    devices.push({
      name: pickName(lan, dhcp),
      ip: lan.ip,
      mac,
      connection: inferConnection(lan, dhcp),
      ...(leaseTime ? { leaseTime } : {}),
    });
  }

  // Firmware variants that do not expose USERDevice can still expose DHCP data.
  if (devices.length === 0 && lanEntries.length === 0) {
    for (const dhcp of dhcpEntries) {
      const mac = normaliseMac(dhcp.mac);
      if (seen.has(mac)) continue;
      seen.add(mac);
      const leaseTime = parseLeaseTime(dhcp.leaseSeconds);
      devices.push({
        name: dhcp.name && dhcp.name !== '--' ? dhcp.name : `Device-${dhcp.ip.split('.').pop()}`,
        ip: dhcp.ip,
        mac,
        connection: inferConnection(undefined, dhcp),
        ...(leaseTime ? { leaseTime } : {}),
      });
    }
  }

  return devices;
}

function classifyError(err: unknown): RouterError {
  if (err instanceof RouterError) return err;

  const axiosErr = err as AxiosError;
  if (axiosErr?.isAxiosError) {
    if (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ENOTFOUND' || axiosErr.code === 'EHOSTUNREACH') {
      return new RouterError('offline', 'Router is unreachable', err);
    }
    if (axiosErr.code === 'ETIMEDOUT' || axiosErr.code === 'ECONNABORTED') {
      return new RouterError('timeout', 'Request to router timed out', err);
    }
    if (axiosErr.response?.status === 401 || axiosErr.response?.status === 403) {
      return new RouterError('invalid_credentials', 'Invalid router credentials', err);
    }
    if (!axiosErr.response) {
      return new RouterError('offline', 'Router is unreachable', err);
    }
  }

  return new RouterError('unknown', err instanceof Error ? err.message : String(err), err);
}

async function fetchScriptPayload(
  session: HuaweiSession,
  label: string,
  candidates: string[]
): Promise<{ endpoint: string; body: string }> {
  let lastResponse = '';

  for (const endpoint of candidates) {
    try {
      console.info('[huawei] device request sent: %s', endpoint);
      const response = await withRetry(
        `request ${endpoint}`,
        () => session.client.get(endpoint),
        2
      );
      const body = toResponseString(response.data);
      lastResponse = body;
      console.info('[huawei] device response received: %s (%d chars)', endpoint, body.length);

      if (response.status >= 400) continue;
      if (!body) continue;
      if (isWaitingPage(body) || isLoginPage(body)) continue;

      return { endpoint, body };
    } catch (err) {
      console.warn('[huawei] %s request failed at %s: %s', label, endpoint, err instanceof Error ? err.message : String(err));
    }
  }

  if (lastResponse) {
    console.error('[huawei] raw %s response (truncated): %s', label, lastResponse.slice(0, 1200));
  }
  throw new RouterError('parse_error', `No usable ${label} response from router`);
}

export async function loginHuawei(): Promise<HuaweiSession> {
  const { ip, username, password, timeout } = routerConfig.huawei;
  const client = createHttpClient(ip, timeout);

  try {
    await withRetry('open login page', () => client.get('/'));
    const tokenResponse = await withRetry('fetch login token', () =>
      client.post('/asp/GetRandCount.asp', '')
    );
    const token = sanitiseToken(toResponseString(tokenResponse.data));

    const payload = new URLSearchParams();
    payload.append('UserName', username);
    payload.append('PassWord', encodePassword(password));
    payload.append('Language', LOGIN_LANGUAGE);
    payload.append('x.X_HW_Token', token);

    await withRetry('submit router login', () =>
      client.post('/login.cgi', payload.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: `${ip.replace(/\/+$/, '')}/login.asp`,
          Cookie: `Cookie=body:Language:${LOGIN_LANGUAGE}:id=-1`,
        },
      })
    );

    let authenticated = false;
    let lastVerifyBody = '';
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const verify = await withRetry(`verify router session (attempt ${attempt})`, () =>
        client.get('/index.asp')
      );
      const verifyBody = toResponseString(verify.data);
      lastVerifyBody = verifyBody;

      if (!isWaitingPage(verifyBody) && !isLoginPage(verifyBody)) {
        authenticated = true;
        break;
      }

      if (attempt < 4) {
        await delay(180 * attempt);
      }
    }

    if (!authenticated) {
      console.error('[huawei] auth verify body (truncated): %s', lastVerifyBody.slice(0, 800));
      throw new RouterError('invalid_credentials', 'Router login did not establish an authenticated session');
    }

    console.info('[huawei] router login success');
    return { client, routerIP: ip, username };
  } catch (err) {
    const axiosErr = err as AxiosError;
    console.error(
      '[huawei] login error details: code=%s status=%s message=%s',
      axiosErr?.code ?? 'n/a',
      axiosErr?.response?.status ?? 'n/a',
      err instanceof Error ? err.message : String(err)
    );
    throw classifyError(err);
  }
}

export async function fetchLanDevices(session: HuaweiSession): Promise<LanDeviceEntry[]> {
  const payload = await fetchScriptPayload(session, 'LAN device', [
    '/html/bbsp/common/GetLanUserDevInfo.asp',
    '/GetLanUserDevInfo.asp',
  ]);

  const parsed = parseLanUserDeviceScript(payload.body);
  if (parsed.length > 0) return parsed;

  const legacy = parseLegacyLanArray(payload.body);
  if (legacy.length > 0) return legacy;

  if (/USERDevice|DevInfoArry|UserDevinfo/i.test(payload.body)) {
    return [];
  }

  console.error('[huawei] raw LAN response (truncated): %s', payload.body.slice(0, 1200));
  throw new RouterError('parse_error', `Unable to parse LAN device payload from ${payload.endpoint}`);
}

export async function fetchDhcpDevices(session: HuaweiSession): Promise<DhcpDeviceEntry[]> {
  const payload = await fetchScriptPayload(session, 'DHCP device', [
    '/html/bbsp/common/GetLanUserDhcpInfo.asp',
    '/GetLanUserDhcpInfo.asp',
  ]);

  const parsed = parseDhcpScript(payload.body);
  if (parsed.length > 0) return parsed;

  const legacy = parseLegacyDhcpArray(payload.body);
  if (legacy.length > 0) return legacy;

  if (/DHCPInfo|DhcpInfoArry|UserDhcpinfo/i.test(payload.body)) {
    return [];
  }

  console.error('[huawei] raw DHCP response (truncated): %s', payload.body.slice(0, 1200));
  throw new RouterError('parse_error', `Unable to parse DHCP payload from ${payload.endpoint}`);
}

export async function getHuaweiDevices(): Promise<HuaweiDevicesResponse> {
  const session = await loginHuawei();

  const lanEntries = await fetchLanDevices(session);
  let dhcpEntries: DhcpDeviceEntry[] = [];

  try {
    dhcpEntries = await fetchDhcpDevices(session);
  } catch (err) {
    console.warn('[huawei] DHCP enrichment unavailable: %s', err instanceof Error ? err.message : String(err));
  }

  const devices = mergeDevices(lanEntries, dhcpEntries);
  console.info('[huawei] parsed device count: %d', devices.length);

  return {
    router: ROUTER_NAME,
    routerIP: stripProtocol(session.routerIP),
    deviceCount: devices.length,
    devices,
    source: 'live',
    fetchedAt: new Date().toISOString(),
  };
}

export async function getConnectedDevices(): Promise<HuaweiDevicesResponse> {
  return getHuaweiDevices();
}

export async function getRouterStatus() {
  const data = await getHuaweiDevices();
  return {
    model: ROUTER_NAME,
    firmwareVersion: 'unknown',
    uptime: 0,
    wanIp: 'unknown',
    wanStatus: 'unknown' as const,
    cpuUsage: 0,
    memoryUsage: 0,
    connectedClients: data.deviceCount,
  };
}

export async function getWifiClients(): Promise<HuaweiDevice[]> {
  const data = await getHuaweiDevices();
  return data.devices.filter((device) => device.connection === 'wifi');
}
