/**
 * Tenda N301 / F3 service tests.
 *
 * Test coverage:
 *   1. Router reachability — network error → RouterError(offline)
 *   2. Login success — JSON success response
 *   3. Device list retrieval — goform JSON endpoint parsed correctly
 *   4. Error handling — 403 response → RouterError(invalid_credentials)
 *   5. Timeout handling → RouterError(timeout)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {
  getTendaN301Data,
  getTendaF3Data,
  getMockTendaResponse,
  RouterError,
} from '../tenda';

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
// Sample payloads
// ---------------------------------------------------------------------------

const TENDA_LOGIN_OK = { Result: 0 };
const TENDA_DEVICE_LIST = {
  hostList: [
    { mac: 'AA:BB:CC:DD:EE:01', ip: '192.168.1.10', name: 'MyPhone', type: 'wifi', rssi: -55 },
    { mac: '11:22:33:44:55:66', ip: '192.168.1.20', name: 'Laptop', type: 'lan' },
  ],
};

// ---------------------------------------------------------------------------
// N301 tests
// ---------------------------------------------------------------------------

describe('Tenda N301', () => {
  describe('Reachability', () => {
    it('throws RouterError(offline) on network error', async () => {
      mockAdapter.onPost('/login/Auth').networkError();
      mockAdapter.onPost('/goform/SysToolRestoreSet').networkError();
      mockAdapter.onPost('/').networkError();

      await expect(getTendaN301Data()).rejects.toSatisfy(
        (e: RouterError) => e instanceof RouterError && e.kind === 'offline',
      );
    }, 10_000);
  });

  describe('Login', () => {
    it('succeeds with JSON {Result:0} response', async () => {
      mockAdapter.onPost('/login/Auth').reply(200, TENDA_LOGIN_OK);
      mockAdapter.onGet('/goform/GetOnlineDevInfo').reply(200, TENDA_DEVICE_LIST);
      mockAdapter.onGet(/.*/).reply(404, '');

      const result = await getTendaN301Data();
      expect(result.source).toBe('live');
      expect(result.router).toBe('Tenda N301');
    });

    it('throws RouterError(invalid_credentials) on 403', async () => {
      mockAdapter.onPost('/login/Auth').reply(403, 'Forbidden');
      mockAdapter.onPost('/goform/SysToolRestoreSet').reply(403, 'Forbidden');
      mockAdapter.onPost('/').reply(403, 'Forbidden');

      await expect(getTendaN301Data()).rejects.toSatisfy(
        (e: RouterError) => e instanceof RouterError && e.kind === 'invalid_credentials',
      );
    });
  });

  describe('Device list retrieval', () => {
    it('parses hostList from goform JSON', async () => {
      mockAdapter.onPost('/login/Auth').reply(200, TENDA_LOGIN_OK);
      mockAdapter.onGet('/goform/GetOnlineDevInfo').reply(200, TENDA_DEVICE_LIST);
      mockAdapter.onGet(/.*/).reply(404, '');

      const result = await getTendaN301Data();
      expect(result.devices.length).toBe(2);
      expect(result.devices[0].mac).toBe('AA:BB:CC:DD:EE:01');
      expect(result.devices[0].connection).toBe('wifi');
      expect(result.devices[0].signal).toBe(-55);
      expect(result.devices[1].connection).toBe('ethernet');
    });

    it('returns empty devices when goform returns no list', async () => {
      mockAdapter.onPost('/login/Auth').reply(200, TENDA_LOGIN_OK);
      mockAdapter.onGet(/.*/).reply(200, { status: 'ok' }); // no hostList

      const result = await getTendaN301Data();
      expect(result.devices).toBeInstanceOf(Array);
      expect(result.source).toBe('live');
    });
  });

  describe('Timeout', () => {
    it('throws RouterError(timeout)', async () => {
      mockAdapter.onPost('/login/Auth').timeout();
      mockAdapter.onPost('/goform/SysToolRestoreSet').timeout();
      mockAdapter.onPost('/').timeout();

      await expect(getTendaN301Data()).rejects.toSatisfy(
        (e: RouterError) => e instanceof RouterError && e.kind === 'timeout',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// F3 tests (same logic, different model label)
// ---------------------------------------------------------------------------

describe('Tenda F3', () => {
  it('returns source="live" and model="Tenda F3" on success', async () => {
    mockAdapter.onPost('/login/Auth').reply(200, TENDA_LOGIN_OK);
    mockAdapter.onGet('/goform/GetOnlineDevInfo').reply(200, TENDA_DEVICE_LIST);
    mockAdapter.onGet(/.*/).reply(404, '');

    const result = await getTendaF3Data();
    expect(result.source).toBe('live');
    expect(result.router).toBe('Tenda F3');
  });
});

// ---------------------------------------------------------------------------
// Mock fixture integrity
// ---------------------------------------------------------------------------

describe('getMockTendaResponse (fixture)', () => {
  it('N301 fixture has correct structure', () => {
    const m = getMockTendaResponse('N301', 'http://192.168.1.3');
    expect(m.router).toBe('Tenda N301');
    expect(m.devices.length).toBeGreaterThan(0);
    for (const d of m.devices) {
      expect(d).toHaveProperty('mac');
      expect(d).toHaveProperty('ip');
    }
  });

  it('F3 fixture has correct structure', () => {
    const m = getMockTendaResponse('F3', 'http://192.168.1.4');
    expect(m.router).toBe('Tenda F3');
    expect(m.devices.length).toBeGreaterThan(0);
  });
});
