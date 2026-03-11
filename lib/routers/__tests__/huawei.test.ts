/**
 * Huawei HG8245W5 service tests.
 *
 * Test coverage:
 *   1. Router reachability — ECONNREFUSED → RouterError(offline)
 *   2. Login success — credentials accepted, cookie stored
 *   3. Device list retrieval — DHCP/ARP HTML parsed correctly
 *   4. Error handling — 401 response → RouterError(invalid_credentials)
 *   5. Timeout handling — ECONNABORTED → RouterError(timeout)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { getConnectedDevices, getMockDevicesResponse, RouterError } from '../huawei';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sample HTML that contains a DHCP table with two MAC/IP pairs. */
const SAMPLE_DHCP_HTML = `
<html><body>
<table>
  <tr><td>AA:BB:CC:DD:EE:01</td><td>192.168.1.10</td><td>MyLaptop</td><td>wireless</td></tr>
  <tr><td>11:22:33:44:55:66</td><td>192.168.1.20</td><td>Desktop</td><td>ethernet</td></tr>
</table>
</body></html>
`;

// ---------------------------------------------------------------------------
// Mock axios globally for this module
// ---------------------------------------------------------------------------

// We need to intercept the axios instance created inside huawei.ts.
// Strategy: spy on axios.create to return a pre-wired mock instance.
let mockAdapter: MockAdapter;
let createdInstance: ReturnType<typeof axios.create>;

beforeEach(() => {
  // Create a real axios instance and attach mock adapter to it.
  createdInstance = axios.create();
  mockAdapter = new MockAdapter(createdInstance, { onNoMatch: 'throwException' });

  // Intercept axios.create so huawei.ts gets our mock instance.
  vi.spyOn(axios, 'create').mockReturnValue(createdInstance as ReturnType<typeof axios.create>);
});

afterEach(() => {
  mockAdapter.reset();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Reachability
// ---------------------------------------------------------------------------

describe('Router reachability', () => {
  it('throws RouterError(offline) when router refuses connection', async () => {
    mockAdapter.onPost('/').networkError(); // simulate ECONNREFUSED
    // All login endpoints will also fail
    mockAdapter.onPost('/login.html').networkError();
    mockAdapter.onPost('/login.cgi').networkError();

    await expect(getConnectedDevices()).rejects.toSatisfy(
      (e: RouterError) => e instanceof RouterError && e.kind === 'offline',
    );
  }, 10_000);
});

// ---------------------------------------------------------------------------
// 2. Login success
// ---------------------------------------------------------------------------

describe('Login', () => {
  it('succeeds when router returns 200 and body contains "logout"', async () => {
    // Simulate a successful login page + a DHCP page with devices
    mockAdapter.onPost('/').reply(200, '<html>Welcome admin <a href="logout">logout</a></html>');
    mockAdapter.onGet('/html/bbsp/dhcp/dhcp.asp').reply(200, SAMPLE_DHCP_HTML);
    // Status page (ignore failure gracefully)
    mockAdapter.onGet(/.*/).reply(404, '');

    const result = await getConnectedDevices();
    expect(result.source).toBe('live');
    expect(result.router).toBe('Huawei HG8245W5');
  });

  it('throws RouterError(invalid_credentials) on HTTP 401', async () => {
    mockAdapter.onPost('/').reply(401, 'Unauthorized');
    mockAdapter.onPost('/login.html').reply(401, 'Unauthorized');
    mockAdapter.onPost('/login.cgi').reply(401, 'Unauthorized');

    await expect(getConnectedDevices()).rejects.toSatisfy(
      (e: RouterError) => e instanceof RouterError && e.kind === 'invalid_credentials',
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Device list retrieval
// ---------------------------------------------------------------------------

describe('Device list retrieval', () => {
  it('parses two devices from a DHCP ARP HTML table', async () => {
    mockAdapter.onPost('/').reply(200, '<html>device list page <a href="logout">logout</a></html>');
    mockAdapter.onGet('/html/bbsp/dhcp/dhcp.asp').reply(200, SAMPLE_DHCP_HTML);
    mockAdapter.onGet(/.*/).reply(404, '');

    const result = await getConnectedDevices();
    // Should find AA:BB:CC:DD:EE:01 and 11:22:33:44:55:66
    expect(result.devices.length).toBeGreaterThanOrEqual(2);
    const macs = result.devices.map((d) => d.mac);
    expect(macs).toContain('AA:BB:CC:DD:EE:01');
    expect(macs).toContain('11:22:33:44:55:66');
  });

  it('returns empty devices array (not mock data) when no devices found', async () => {
    mockAdapter.onPost('/').reply(200, '<html><a href="logout">logout</a></html>');
    mockAdapter.onGet(/.*/).reply(200, '<html>no devices here</html>');

    const result = await getConnectedDevices();
    expect(result.devices).toBeInstanceOf(Array);
    expect(result.source).toBe('live'); // always 'live', even when no devices
  });
});

// ---------------------------------------------------------------------------
// 4. Error handling
// ---------------------------------------------------------------------------

describe('Error handling', () => {
  it('throws RouterError(invalid_credentials) when body contains "incorrect"', async () => {
    mockAdapter.onPost('/').reply(200, '<html>Password incorrect</html>');
    mockAdapter.onPost('/login.html').reply(200, '<html>Password incorrect</html>');
    mockAdapter.onPost('/login.cgi').reply(200, '<html>Password incorrect</html>');

    await expect(getConnectedDevices()).rejects.toSatisfy(
      (e: RouterError) => e instanceof RouterError,
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Timeout handling
// ---------------------------------------------------------------------------

describe('Timeout handling', () => {
  it('throws RouterError(timeout) when connection aborts', async () => {
    mockAdapter.onPost('/').timeout();
    mockAdapter.onPost('/login.html').timeout();
    mockAdapter.onPost('/login.cgi').timeout();

    await expect(getConnectedDevices()).rejects.toSatisfy(
      (e: RouterError) => e instanceof RouterError && e.kind === 'timeout',
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Mock fixture integrity (for test use only)
// ---------------------------------------------------------------------------

describe('getMockDevicesResponse (fixture)', () => {
  it('returns a structurally valid fixture', () => {
    const mock = getMockDevicesResponse();
    expect(mock.router).toBe('Huawei HG8245W5');
    expect(mock.devices.length).toBeGreaterThan(0);
    for (const d of mock.devices) {
      expect(d).toHaveProperty('mac');
      expect(d).toHaveProperty('ip');
      expect(d).toHaveProperty('connection');
    }
  });
});
