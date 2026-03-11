/**
 * IP Camera service tests.
 *
 * Test coverage:
 *   1. Camera online — status endpoint responds
 *   2. Camera offline — ECONNREFUSED → CameraError(offline)
 *   3. Auth failure — 401 response → CameraError(invalid_credentials)
 *   4. Model and firmware parsed from JSON status endpoint
 *   5. Motion detection — endpoint returns "motion: true"
 *   6. Timeout handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { getCameraStatus, getMockCameraStatus, CameraError } from '../camera';

// Stub config so requireEnv() never throws during tests.
vi.mock('@/lib/config', () => ({
  devicesConfig: {
    camera: { ip: 'http://192.168.1.20', username: 'admin', password: 'testpw', timeout: 5000 },
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
// 1. Camera online
// ---------------------------------------------------------------------------

describe('Camera online', () => {
  it('returns status="online" when reachable', async () => {
    mockAdapter.onGet('/api/v1/status').reply(200, { model: 'IPCam-Pro', firmware: 'v2.3', uptime: 3600 });
    mockAdapter.onGet(/.*/).reply(404, '');

    const result = await getCameraStatus();
    expect(result.status).toBe('online');
    expect(result.source).toBe('live');
    expect(result.model).toBe('IPCam-Pro');
  });
});

// ---------------------------------------------------------------------------
// 2. Camera offline
// ---------------------------------------------------------------------------

describe('Camera offline', () => {
  it('throws CameraError(offline) on network error', async () => {
    mockAdapter.onGet(/.*/).networkError();

    await expect(getCameraStatus()).rejects.toSatisfy(
      (e: CameraError) => e instanceof CameraError && e.kind === 'offline',
    );
  }, 10_000);
});

// ---------------------------------------------------------------------------
// 3. Auth failure
// ---------------------------------------------------------------------------

describe('Auth failure', () => {
  it('throws CameraError(invalid_credentials) on 401', async () => {
    mockAdapter.onGet('/api/v1/status').reply(401, 'Unauthorized');
    mockAdapter.onGet('/status.json').reply(401, 'Unauthorized');
    mockAdapter.onGet('/cgi-bin/status.cgi').reply(401, 'Unauthorized');
    mockAdapter.onGet('/ISAPI/System/deviceInfo').reply(401, 'Unauthorized');
    mockAdapter.onGet('/cgi-bin/magicBox.cgi').reply(401, 'Unauthorized');
    mockAdapter.onGet('/').reply(401, 'Unauthorized');
    // Motion check
    mockAdapter.onGet('/cgi-bin/motion.cgi').reply(401);
    mockAdapter.onGet('/api/v1/motion').reply(401);
    mockAdapter.onGet('/ISAPI/System/Video/channels/1/motionDetection').reply(401);

    await expect(getCameraStatus()).rejects.toSatisfy(
      (e: CameraError) => e instanceof CameraError && e.kind === 'invalid_credentials',
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Model + firmware extraction
// ---------------------------------------------------------------------------

describe('Status parsing', () => {
  it('parses model and firmwareVersion from JSON', async () => {
    mockAdapter
      .onGet('/api/v1/status')
      .reply(200, { model: 'HikvisionDS-2CD', firmware: 'V5.7.3', uptime: 86400 });
    mockAdapter.onGet(/.*/).reply(404, '');

    const result = await getCameraStatus();
    expect(result.model).toBe('HikvisionDS-2CD');
    expect(result.firmwareVersion).toBe('V5.7.3');
    expect(result.uptime).toBe(86400);
  });

  it('falls back to "IP Camera" when no model field present', async () => {
    mockAdapter.onGet('/api/v1/status').reply(200, { foobar: 1 });
    mockAdapter.onGet(/.*/).reply(404, '');

    const result = await getCameraStatus();
    expect(result.model).toBe('IP Camera');
  });
});

// ---------------------------------------------------------------------------
// 5. Motion detection
// ---------------------------------------------------------------------------

describe('Motion detection', () => {
  it('sets motionDetected=true when motion endpoint says detected', async () => {
    mockAdapter.onGet('/api/v1/status').reply(200, { model: 'Cam1', motionDetected: true });
    mockAdapter.onGet(/.*/).reply(404, '');

    const result = await getCameraStatus();
    expect(result.motionDetected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Timeout
// ---------------------------------------------------------------------------

describe('Timeout handling', () => {
  it('throws CameraError(timeout) when request times out', async () => {
    mockAdapter.onGet(/.*/).timeout();

    await expect(getCameraStatus()).rejects.toSatisfy(
      (e: CameraError) => e instanceof CameraError && e.kind === 'timeout',
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Mock fixture
// ---------------------------------------------------------------------------

describe('getMockCameraStatus (fixture)', () => {
  it('returns a structurally valid camera fixture', () => {
    const m = getMockCameraStatus();
    expect(m.device).toBeTruthy();
    expect(m.streamUrl).toBeTruthy();
    expect(m.snapshotUrl).toBeTruthy();
    expect(typeof m.motionDetected).toBe('boolean');
  });
});
