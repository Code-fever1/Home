/**
 * Network Aggregator tests.
 *
 * Tests verify that the aggregator:
 *   1. Polls all four routers + camera in parallel and merges results
 *   2. Sets router status="online" when fetch succeeds
 *   3. Sets router status="offline" (no mock data) when a router fails
 *   4. Returns empty device list (not fake data) for offline routers
 *   5. Includes D-Link in the topology tree
 *   6. Summary counts are accurate
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { NormalisedRouter, NormalisedDevice } from '../aggregator';

// ---------------------------------------------------------------------------
// Module mocks — replace every router/camera module with controllable fakes
// ---------------------------------------------------------------------------

const mockHuaweiDevices = vi.fn();
const mockTendaN301 = vi.fn();
const mockTendaF3 = vi.fn();
const mockDlinkData = vi.fn();
const mockCameraStatus = vi.fn();

vi.mock('@/lib/routers/huawei', () => ({
  getConnectedDevices: mockHuaweiDevices,
  RouterError: class RouterError extends Error {
    constructor(public kind: string, msg: string) { super(msg); }
  },
}));

vi.mock('@/lib/routers/tenda', () => ({
  getTendaN301Data: mockTendaN301,
  getTendaF3Data: mockTendaF3,
  RouterError: class RouterError extends Error {
    constructor(public kind: string, msg: string) { super(msg); }
  },
}));

vi.mock('@/lib/routers/dlink', () => ({
  getDlinkData: mockDlinkData,
  RouterError: class RouterError extends Error {
    constructor(public kind: string, msg: string) { super(msg); }
  },
}));

vi.mock('@/lib/devices/camera', () => ({
  getCameraStatus: mockCameraStatus,
  CameraError: class CameraError extends Error {
    constructor(public kind: string, msg: string) { super(msg); }
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks are registered
// ---------------------------------------------------------------------------

const { getNetworkTopology } = await import('../aggregator');

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeHuaweiResponse(deviceCount = 2) {
  return {
    router: 'Huawei HG8245W5',
    routerIP: '100.10.10.1',
    deviceCount,
    devices: Array.from({ length: deviceCount }, (_, i) => ({
      name: `Device-${i}`, ip: `192.168.1.${10 + i}`,
      mac: `AA:BB:CC:DD:EE:0${i}`, connection: 'wifi' as const, signal: -50,
    })),
    source: 'live' as const,
    fetchedAt: new Date().toISOString(),
  };
}

function makeTendaResponse(model: string, ip = 'http://192.168.1.3') {
  return {
    router: model,
    routerIp: ip,
    deviceCount: 1,
    devices: [{ name: 'Phone', ip: '192.168.1.11', mac: 'BB:BB:BB:BB:BB:01', connection: 'wifi' as const }],
    source: 'live' as const,
    fetchedAt: new Date().toISOString(),
    status: { wanIp: '1.2.3.4', wanStatus: 'connected' as const },
  };
}

function makeDlinkResponse() {
  return {
    router: 'D-Link X1852E',
    routerIp: 'http://100.10.10.5',
    deviceCount: 1,
    devices: [{ name: 'Tablet', ip: '192.168.0.10', mac: 'CC:CC:CC:CC:CC:01', connection: 'wifi' as const }],
    source: 'live' as const,
    fetchedAt: new Date().toISOString(),
    status: { wanIp: '1.2.3.5' },
  };
}

function makeCameraStatus() {
  return {
    device: 'IP Camera', ip: 'http://100.10.10.2', status: 'online' as const,
    model: 'Generic', streamUrl: 'rtsp://100.10.10.2/stream',
    snapshotUrl: 'http://100.10.10.2/snapshot.jpg',
    motionDetected: false, source: 'live' as const, fetchedAt: new Date().toISOString(),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. All routers online
// ---------------------------------------------------------------------------

describe('All routers online', () => {
  it('returns four online routers and merges all devices', async () => {
    mockHuaweiDevices.mockResolvedValue(makeHuaweiResponse(2));
    mockTendaN301.mockResolvedValue(makeTendaResponse('Tenda N301'));
    mockTendaF3.mockResolvedValue(makeTendaResponse('Tenda F3', 'http://192.168.1.4'));
    mockDlinkData.mockResolvedValue(makeDlinkResponse());
    mockCameraStatus.mockResolvedValue(makeCameraStatus());

    const topo = await getNetworkTopology();

    expect(topo.summary.totalRouters).toBe(4);
    expect(topo.summary.onlineRouters).toBe(4);
    expect(topo.summary.totalDevices).toBe(5); // 2+1+1+1
    expect(topo.summary.totalCameras).toBe(1);

    const statuses = topo.routers.map((r: NormalisedRouter) => r.status);
    expect(statuses.every((s) => s === 'online')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Offline router — no fake data substituted
// ---------------------------------------------------------------------------

describe('Offline router', () => {
  it('sets status="offline" and returns empty devices when Huawei fails', async () => {
    // RouterError class is mocked; let's throw a plain error with a kind prop
    const { RouterError } = await import('@/lib/routers/huawei');
    mockHuaweiDevices.mockRejectedValue(new RouterError('offline', 'Huawei unreachable'));

    mockTendaN301.mockResolvedValue(makeTendaResponse('Tenda N301'));
    mockTendaF3.mockResolvedValue(makeTendaResponse('Tenda F3', 'http://192.168.1.4'));
    mockDlinkData.mockResolvedValue(makeDlinkResponse());
    mockCameraStatus.mockResolvedValue(makeCameraStatus());

    const topo = await getNetworkTopology();

    const huawei = topo.routers.find((r: NormalisedRouter) => r.id === 'huawei')!;
    expect(huawei.status).toBe('offline');
    expect(huawei.error).toBeDefined();
    expect(huawei.error!.kind).toBe('offline');

    // No fake devices should exist for Huawei
    const huaweiDevices = topo.devices.filter((d: NormalisedDevice) => d.routerId === 'huawei');
    expect(huaweiDevices.length).toBe(0);

    // Other routers should still be online
    expect(topo.summary.onlineRouters).toBe(3);
  });

  it('sets D-Link to offline when getDlinkData throws', async () => {
    mockHuaweiDevices.mockResolvedValue(makeHuaweiResponse());
    mockTendaN301.mockResolvedValue(makeTendaResponse('Tenda N301'));
    mockTendaF3.mockResolvedValue(makeTendaResponse('Tenda F3'));
    const { RouterError } = await import('@/lib/routers/dlink');
    mockDlinkData.mockRejectedValue(new RouterError('timeout', 'D-Link timed out'));
    mockCameraStatus.mockResolvedValue(makeCameraStatus());

    const topo = await getNetworkTopology();
    const dlink = topo.routers.find((r: NormalisedRouter) => r.id === 'dlink-x1852e')!;
    expect(dlink.status).toBe('offline');
    expect(dlink.error?.kind).toBe('timeout');
  });
});

// ---------------------------------------------------------------------------
// 3. Topology tree structure
// ---------------------------------------------------------------------------

describe('Topology tree', () => {
  it('has Internet as root with all four router children', async () => {
    mockHuaweiDevices.mockResolvedValue(makeHuaweiResponse(1));
    mockTendaN301.mockResolvedValue(makeTendaResponse('Tenda N301'));
    mockTendaF3.mockResolvedValue(makeTendaResponse('Tenda F3'));
    mockDlinkData.mockResolvedValue(makeDlinkResponse());
    mockCameraStatus.mockResolvedValue(makeCameraStatus());

    const topo = await getNetworkTopology();
    expect(topo.topology.type).toBe('internet');
    expect(topo.topology.children.length).toBe(4);
    const routerIds = topo.topology.children.map((c) => c.id);
    expect(routerIds).toContain('huawei');
    expect(routerIds).toContain('tenda-n301');
    expect(routerIds).toContain('tenda-f3');
    expect(routerIds).toContain('dlink-x1852e');
  });

  it('places camera as a child of the Huawei gateway node', async () => {
    mockHuaweiDevices.mockResolvedValue(makeHuaweiResponse(0));
    mockTendaN301.mockResolvedValue(makeTendaResponse('Tenda N301'));
    mockTendaF3.mockResolvedValue(makeTendaResponse('Tenda F3'));
    mockDlinkData.mockResolvedValue(makeDlinkResponse());
    mockCameraStatus.mockResolvedValue(makeCameraStatus());

    const topo = await getNetworkTopology();
    const huaweiNode = topo.topology.children.find((c) => c.id === 'huawei')!;
    const cameraChild = huaweiNode.children.find((c) => c.type === 'camera');
    expect(cameraChild).toBeDefined();
    expect(cameraChild?.type).toBe('camera');
  });
});

// ---------------------------------------------------------------------------
// 4. fetchedAt is present and ISO 8601
// ---------------------------------------------------------------------------

describe('Metadata', () => {
  it('fetchedAt is a valid ISO 8601 string', async () => {
    mockHuaweiDevices.mockResolvedValue(makeHuaweiResponse());
    mockTendaN301.mockResolvedValue(makeTendaResponse('Tenda N301'));
    mockTendaF3.mockResolvedValue(makeTendaResponse('Tenda F3'));
    mockDlinkData.mockResolvedValue(makeDlinkResponse());
    mockCameraStatus.mockResolvedValue(makeCameraStatus());

    const topo = await getNetworkTopology();
    expect(() => new Date(topo.fetchedAt)).not.toThrow();
    expect(new Date(topo.fetchedAt).toString()).not.toBe('Invalid Date');
  });
});
