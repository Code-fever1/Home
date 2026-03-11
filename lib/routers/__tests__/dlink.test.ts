/**
 * D-Link X1852E service tests.
 *
 * Test coverage:
 *   1. Reachability — network error → RouterError(offline)
 *   2. Modern JSON login success
 *   3. HNAP login — challenge/response exchange
 *   4. Device list via JSON endpoint
 *   5. Device list via HNAP XML response
 *   6. Device list via HTML ARP scraping fallback
 *   7. Error handling — 401 / invalid credentials
 *   8. Timeout handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { getDlinkData, getMockDlinkResponse, RouterError } from '../dlink';

// Stub config so requireEnv() never throws during tests.
vi.mock('@/lib/config', () => ({
  devicesConfig: {
    dlinkX1852e: { ip: 'http://192.168.1.5', username: 'admin', password: 'testpw', timeout: 5000 },
  },
}));

// ---------------------------------------------------------------------------
// Axios mock setup
// ---------------------------------------------------------------------------

let mockAdapter: MockAdapter;
let createdInstance: ReturnType<typeof axios.create>;

beforeEach(() => {
  createdInstance = axios.create();
  mockAdapter = new MockAdapter(createdInstance, { onNoMatch: 'throwException' });
  vi.spyOn(axios, 'create').mockReturnValue(createdInstance as ReturnType<typeof axios.create>);
});

afterEach(() => {
  mockAdapter.reset();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const JSON_DEVICE_LIST = {
  hostList: [
    { mac: 'AA:BB:CC:DD:EE:10', ip: '192.168.0.10', name: 'SmartTV', type: 'wifi' },
    { mac: 'FF:EE:DD:CC:BB:01', ip: '192.168.0.20', name: 'NAS', type: 'wired' },
  ],
};

const HNAP_PHASE1_RESPONSE = `
<LoginResponse xmlns="http://purenetworks.com/HNAP1/">
  <LoginResult>OK</LoginResult>
  <Challenge>CHALLENGE123</Challenge>
  <PublicKey>PUBKEY456</PublicKey>
  <Cookie>ABC_COOKIE</Cookie>
</LoginResponse>`;

// Phase-2 success (LoginResult must be "success")
const HNAP_PHASE2_RESPONSE = `
<LoginResponse xmlns="http://purenetworks.com/HNAP1/">
  <LoginResult>success</LoginResult>
</LoginResponse>`;

const HNAP_CLIENT_LIST_RESPONSE = `
<GetClientInfoResponse xmlns="http://purenetworks.com/HNAP1/">
  <ClientInfo>
    <NickName>Tablet</NickName>
    <MACAddress>AA:BB:CC:00:00:01</MACAddress>
    <IPAddress>192.168.0.30</IPAddress>
    <Type>wifi</Type>
    <RSSI>-60</RSSI>
  </ClientInfo>
</GetClientInfoResponse>`;

const HTML_WITH_ARP = `
<html><body>
  <table>
    <tr><td>AA:BB:CC:DD:11:22</td><td>192.168.0.50</td><td>Laptop</td></tr>
  </table>
</body></html>`;

// ---------------------------------------------------------------------------
// 1. Reachability
// ---------------------------------------------------------------------------

describe('D-Link reachability', () => {
  it('throws RouterError(offline) when router is unreachable', async () => {
    // All login endpoints unreachable
    mockAdapter.onPost('/cgi-bin/auth_cgi').networkError();
    mockAdapter.onPost('/session').networkError();
    mockAdapter.onPost('/ui/login').networkError();
    mockAdapter.onPost('/cgi-bin/luci/rpc/auth').networkError();
    mockAdapter.onPost('/HNAP1/').networkError();
    mockAdapter.onPost('/').networkError();
    mockAdapter.onPost('/login.html').networkError();
    mockAdapter.onPost('/login.cgi').networkError();

    await expect(getDlinkData()).rejects.toSatisfy(
      (e: RouterError) => e instanceof RouterError && e.kind === 'offline',
    );
  }, 15_000);
});

// ---------------------------------------------------------------------------
// 2. Modern JSON login success
// ---------------------------------------------------------------------------

describe('Modern JSON login', () => {
  it('succeeds when /session returns {result:"ok"}', async () => {
    // /cgi-bin/auth_cgi returns 404 (not found), /session returns ok
    mockAdapter.onPost('/cgi-bin/auth_cgi').reply(404, '');
    mockAdapter.onPost('/session').reply(200, { result: 'ok' });

    // Device list
    mockAdapter.onGet('/cgi-bin/hostmanager_mgr.cgi').reply(200, JSON_DEVICE_LIST);
    mockAdapter.onGet(/.*/).reply(404, '');

    const result = await getDlinkData();
    expect(result.source).toBe('live');
    expect(result.router).toBe('D-Link X1852E');
    expect(result.devices.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 3. HNAP login
// ---------------------------------------------------------------------------

describe('HNAP login', () => {
  it('completes two-phase challenge-response and fetches devices', async () => {
    // All JSON endpoints fail → fall through to HNAP
    for (const p of ['/cgi-bin/auth_cgi', '/session', '/ui/login', '/cgi-bin/luci/rpc/auth']) {
      mockAdapter.onPost(p).reply(404, '');
    }
    // HNAP phase-1
    mockAdapter
      .onPost('/HNAP1/')
      .replyOnce(200, HNAP_PHASE1_RESPONSE)   // phase 1
      .onPost('/HNAP1/')
      .replyOnce(200, HNAP_PHASE2_RESPONSE)   // phase 2
      .onPost('/HNAP1/')
      .reply(200, HNAP_CLIENT_LIST_RESPONSE); // GetClientInfo

    // JSON device endpoints fail
    mockAdapter.onGet(/cgi-bin/).reply(404, '');
    mockAdapter.onGet(/.*/).reply(404, '');

    const result = await getDlinkData();
    expect(result.source).toBe('live');
    // HNAP device list should find 1 client from XML
    expect(result.devices.length).toBeGreaterThanOrEqual(1);
    expect(result.devices[0].mac).toBe('AA:BB:CC:00:00:01');
  });
});

// ---------------------------------------------------------------------------
// 4. JSON device list
// ---------------------------------------------------------------------------

describe('Device list — JSON', () => {
  it('parses hostList correctly including connection type', async () => {
    mockAdapter.onPost('/session').reply(200, { result: 'ok' });
    mockAdapter.onGet('/cgi-bin/auth_cgi').reply(404, '');
    mockAdapter.onGet('/cgi-bin/hostmanager_mgr.cgi').reply(200, JSON_DEVICE_LIST);
    mockAdapter.onGet(/.*/).reply(404, '');

    const result = await getDlinkData();
    const tv = result.devices.find((d) => d.name === 'SmartTV');
    const nas = result.devices.find((d) => d.name === 'NAS');
    expect(tv?.connection).toBe('wifi');
    expect(nas?.connection).toBe('ethernet');
  });
});

// ---------------------------------------------------------------------------
// 5. HTML ARP scraping fallback
// ---------------------------------------------------------------------------

describe('Device list — HTML scraping fallback', () => {
  it('extracts MAC/IP pairs from plain HTML when JSON endpoints return nothing', async () => {
    mockAdapter.onPost('/session').reply(200, { result: 'ok' });
    mockAdapter.onGet('/cgi-bin/auth_cgi').reply(404, '');
    // All JSON device endpoints return empty
    mockAdapter.onGet('/cgi-bin/hostmanager_mgr.cgi').reply(200, {});
    mockAdapter.onGet('/cgi-bin/dhcps_clients.cgi').reply(404, '');
    mockAdapter.onGet('/cgi-bin/connected_devices.cgi').reply(404, '');
    mockAdapter.onGet('/cgi-bin/net_client_list.cgi').reply(404, '');
    mockAdapter.onGet('/api/clients').reply(404, '');
    // HTML pages return ARP table
    mockAdapter.onGet('/').reply(200, HTML_WITH_ARP);
    mockAdapter.onGet(/.*/).reply(404, '');

    const result = await getDlinkData();
    expect(result.devices.length).toBeGreaterThanOrEqual(1);
    expect(result.devices[0].mac).toBe('AA:BB:CC:DD:11:22');
  });
});

// ---------------------------------------------------------------------------
// 6. Auth failure
// ---------------------------------------------------------------------------

describe('Auth failure', () => {
  it('throws RouterError(invalid_credentials) on 401', async () => {
    for (const p of ['/cgi-bin/auth_cgi', '/session', '/ui/login', '/cgi-bin/luci/rpc/auth']) {
      mockAdapter.onPost(p).reply(401, 'Unauthorized');
    }
    mockAdapter.onPost('/HNAP1/').reply(401, 'Unauthorized');
    mockAdapter.onPost('/').reply(401, 'Unauthorized');
    mockAdapter.onPost('/login.html').reply(401, 'Unauthorized');
    mockAdapter.onPost('/login.cgi').reply(401, 'Unauthorized');

    await expect(getDlinkData()).rejects.toSatisfy(
      (e: RouterError) => e instanceof RouterError && e.kind === 'invalid_credentials',
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Timeout
// ---------------------------------------------------------------------------

describe('Timeout', () => {
  it('throws RouterError(timeout)', async () => {
    for (const p of ['/cgi-bin/auth_cgi', '/session', '/ui/login', '/cgi-bin/luci/rpc/auth']) {
      mockAdapter.onPost(p).timeout();
    }
    mockAdapter.onPost('/HNAP1/').timeout();
    mockAdapter.onPost('/').timeout();
    mockAdapter.onPost('/login.html').timeout();
    mockAdapter.onPost('/login.cgi').timeout();

    await expect(getDlinkData()).rejects.toSatisfy(
      (e: RouterError) => e instanceof RouterError && e.kind === 'timeout',
    );
  });
});

// ---------------------------------------------------------------------------
// 8. Mock fixture
// ---------------------------------------------------------------------------

describe('getMockDlinkResponse (fixture)', () => {
  it('returns a valid fixture with 2 devices', () => {
    const m = getMockDlinkResponse('http://192.168.0.1');
    expect(m.router).toBe('D-Link X1852E');
    expect(m.devices.length).toBe(2);
    for (const d of m.devices) {
      expect(d).toHaveProperty('mac');
      expect(d).toHaveProperty('ip');
    }
  });
});
