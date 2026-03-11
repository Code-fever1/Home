/**
 * Network Aggregator — SERVER SIDE ONLY.
 *
 * Fetches data from all network devices in parallel, normalises the results
 * into a single unified response, and builds a network topology tree.
 *
 * Each device fetch is isolated: failure of one device never fails the others.
 * Routers that are offline or fail authentication return status "offline" with
 * an empty device list — no fake/mock data is ever returned at runtime.
 *
 * Log legend:
 *   [aggregator] →   polling started
 *   [aggregator/X] ✓ live data fetched successfully
 *   [aggregator/X] ✗ fetch failed (kind + message)
 */

import {
  getConnectedDevices as getHuaweiDevices,
  RouterError,
  type RouterDevice,
  type DevicesResponse as HuaweiResponse,
} from '@/lib/routers/huawei';

import {
  getTendaN301Data,
  getTendaF3Data,
  type TendaDevicesResponse,
  type TendaDevice,
} from '@/lib/routers/tenda';

import {
  getDlinkData,
  type DlinkDevicesResponse,
  type DlinkDevice,
} from '@/lib/routers/dlink';

import {
  getCameraStatus,
  CameraError,
  type CameraStatus,
} from '@/lib/devices/camera';

// ---------------------------------------------------------------------------
// Shared normalised types
// ---------------------------------------------------------------------------

export interface NormalisedDevice {
  id: string;
  name: string;
  ip: string;
  mac: string;
  connection: 'wifi' | 'ethernet' | 'unknown';
  signal?: number;
  routerId: string;     // parent router identifier
  routerName: string;
}

export interface NormalisedRouter {
  id: string;
  name: string;
  model: string;
  ip: string;
  /** 'online' = live data received; 'offline' = unreachable / auth failure */
  status: 'online' | 'offline';
  source: 'live';
  wanIp?: string;
  connectedClients: number;
  fetchedAt: string;
  error?: { kind: string; message: string };
}

export interface NormalisedCamera {
  id: string;
  device: string;
  ip: string;
  status: 'online' | 'offline' | 'unknown';
  model?: string;
  streamUrl: string;
  snapshotUrl: string;
  motionDetected: boolean;
  source: 'live';
  fetchedAt: string;
  error?: { kind: string; message: string };
}

/** The full unified topology returned by the aggregator. */
export interface NetworkTopology {
  fetchedAt: string;
  /** Summary counts */
  summary: {
    totalRouters: number;
    onlineRouters: number;
    totalDevices: number;
    totalCameras: number;
  };
  /** All routers (Huawei + Tendas + D-Link) */
  routers: NormalisedRouter[];
  /** All client devices, each linked to a parent routerId */
  devices: NormalisedDevice[];
  /** All cameras */
  cameras: NormalisedCamera[];
  /** Tree-structured topology for visualisation */
  topology: TopologyNode;
}

export interface TopologyNode {
  id: string;
  name: string;
  type: 'internet' | 'router' | 'device' | 'camera';
  /** 'online' = reachable; 'offline' = unreachable; 'unknown' = camera didn't respond */
  status: 'online' | 'offline' | 'unknown';
  ip?: string;
  meta?: Record<string, unknown>;
  children: TopologyNode[];
}

// ---------------------------------------------------------------------------

// Safe fetch helpers — never throw, always return a result.
// On failure: returns an empty-device live response + error info.
// NO mock data is ever substituted at runtime.
// ---------------------------------------------------------------------------

type RouterErrorInfo = { kind: string; message: string };

async function safeHuawei(): Promise<{ data: HuaweiResponse; error?: RouterErrorInfo }> {
  console.info('[aggregator] → polling Huawei HG8245W5…');
  try {
    const data = await getHuaweiDevices();
    console.info('[aggregator/huawei] ✓ login OK — %d device(s)', data.deviceCount);
    return { data };
  } catch (err) {
    const kind = (err as RouterError)?.kind ?? 'unknown';
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[aggregator/huawei] ✗ %s: %s', kind, message);
    return {
      data: { router: 'Huawei HG8245W5', deviceCount: 0, devices: [], source: 'live', fetchedAt: new Date().toISOString() },
      error: { kind, message },
    };
  }
}

async function safeTendaN301(): Promise<{ data: TendaDevicesResponse; error?: RouterErrorInfo }> {
  console.info('[aggregator] → polling Tenda N301…');
  try {
    const data = await getTendaN301Data();
    console.info('[aggregator/tenda-n301] ✓ login OK — %d device(s)', data.deviceCount);
    return { data };
  } catch (err) {
    const kind = (err as RouterError)?.kind ?? 'unknown';
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[aggregator/tenda-n301] ✗ %s: %s', kind, message);
    return {
      data: { router: 'Tenda N301', routerIp: '', deviceCount: 0, devices: [], source: 'live', fetchedAt: new Date().toISOString(), status: {} },
      error: { kind, message },
    };
  }
}

async function safeTendaF3(): Promise<{ data: TendaDevicesResponse; error?: RouterErrorInfo }> {
  console.info('[aggregator] → polling Tenda F3…');
  try {
    const data = await getTendaF3Data();
    console.info('[aggregator/tenda-f3] ✓ login OK — %d device(s)', data.deviceCount);
    return { data };
  } catch (err) {
    const kind = (err as RouterError)?.kind ?? 'unknown';
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[aggregator/tenda-f3] ✗ %s: %s', kind, message);
    return {
      data: { router: 'Tenda F3', routerIp: '', deviceCount: 0, devices: [], source: 'live', fetchedAt: new Date().toISOString(), status: {} },
      error: { kind, message },
    };
  }
}

async function safeDlink(): Promise<{ data: DlinkDevicesResponse; error?: RouterErrorInfo }> {
  console.info('[aggregator] → polling D-Link X1852E…');
  try {
    const data = await getDlinkData();
    console.info('[aggregator/dlink] ✓ login OK — %d device(s)', data.deviceCount);
    return { data };
  } catch (err) {
    const kind = (err as RouterError)?.kind ?? 'unknown';
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[aggregator/dlink] ✗ %s: %s', kind, message);
    return {
      data: { router: 'D-Link X1852E', routerIp: '', deviceCount: 0, devices: [], source: 'live', fetchedAt: new Date().toISOString(), status: {} },
      error: { kind, message },
    };
  }
}

async function safeCamera(): Promise<{ data: CameraStatus; error?: RouterErrorInfo }> {
  console.info('[aggregator] → polling IP camera…');
  try {
    const data = await getCameraStatus();
    console.info('[aggregator/camera] ✓ camera online — motion=%s', data.motionDetected);
    return { data };
  } catch (err) {
    const kind = (err as CameraError)?.kind ?? 'unknown';
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[aggregator/camera] ✗ %s: %s', kind, message);
    const ip = (err as { ip?: string }).ip ?? '';
    return {
      data: {
        device: 'IP Camera', ip, status: 'offline', streamUrl: '', snapshotUrl: '',
        motionDetected: false, source: 'live', fetchedAt: new Date().toISOString(),
      },
      error: { kind, message },
    };
  }
}

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

function huaweiToRouter(res: HuaweiResponse, error?: RouterErrorInfo): NormalisedRouter {
  return {
    id: 'huawei',
    name: 'Main Gateway',
    model: res.router,
    ip: 'http://100.10.10.1',
    status: error ? 'offline' : 'online',
    source: 'live',
    connectedClients: res.deviceCount,
    fetchedAt: res.fetchedAt,
    error,
  };
}

function tendaToRouter(
  res: TendaDevicesResponse,
  id: 'tenda-n301' | 'tenda-f3',
  error?: RouterErrorInfo,
): NormalisedRouter {
  return {
    id,
    name: res.router,
    model: res.router,
    ip: res.routerIp,
    status: error ? 'offline' : 'online',
    source: 'live',
    wanIp: res.status.wanIp,
    connectedClients: res.deviceCount,
    fetchedAt: res.fetchedAt,
    error,
  };
}

function dlinkToRouter(res: DlinkDevicesResponse, error?: RouterErrorInfo): NormalisedRouter {
  return {
    id: 'dlink-x1852e',
    name: res.router,
    model: res.router,
    ip: res.routerIp,
    status: error ? 'offline' : 'online',
    source: 'live',
    wanIp: res.status.wanIp,
    connectedClients: res.deviceCount,
    fetchedAt: res.fetchedAt,
    error,
  };
}

function huaweiDevicesToNormalised(devices: RouterDevice[], routerId: string, routerName: string): NormalisedDevice[] {
  return devices.map((d, i) => ({
    id: `${routerId}-device-${i}`,
    name: d.name,
    ip: d.ip,
    mac: d.mac,
    connection: d.connection,
    signal: d.signal,
    routerId,
    routerName,
  }));
}

function tendaDevicesToNormalised(devices: TendaDevice[], routerId: string, routerName: string): NormalisedDevice[] {
  return devices.map((d, i) => ({
    id: `${routerId}-device-${i}`,
    name: d.name,
    ip: d.ip,
    mac: d.mac,
    connection: d.connection,
    signal: d.signal,
    routerId,
    routerName,
  }));
}

function dlinkDevicesToNormalised(devices: DlinkDevice[], routerId: string, routerName: string): NormalisedDevice[] {
  return devices.map((d, i) => ({
    id: `${routerId}-device-${i}`,
    name: d.name,
    ip: d.ip,
    mac: d.mac,
    connection: d.connection,
    signal: d.signal,
    routerId,
    routerName,
  }));
}

function cameraToNormalised(cam: CameraStatus, error?: RouterErrorInfo): NormalisedCamera {
  return {
    id: 'camera-0',
    device: cam.device,
    ip: cam.ip,
    status: error ? 'offline' : cam.status,
    model: cam.model,
    streamUrl: cam.streamUrl,
    snapshotUrl: cam.snapshotUrl,
    motionDetected: cam.motionDetected,
    source: 'live',
    fetchedAt: cam.fetchedAt,
    error,
  };
}

// ---------------------------------------------------------------------------
// Topology builder
// ---------------------------------------------------------------------------

function buildTopology(
  routers: NormalisedRouter[],
  devices: NormalisedDevice[],
  cameras: NormalisedCamera[]
): TopologyNode {
  const devicesByRouter: Record<string, NormalisedDevice[]> = {};
  for (const d of devices) {
    devicesByRouter[d.routerId] = devicesByRouter[d.routerId] ?? [];
    devicesByRouter[d.routerId].push(d);
  }

  const cameraNodes: TopologyNode[] = cameras.map((cam) => ({
    id: cam.id,
    name: cam.device,
    type: 'camera',
    status: cam.status,
    ip: cam.ip,
    meta: { streamUrl: cam.streamUrl, motionDetected: cam.motionDetected, source: cam.source, error: cam.error },
    children: [],
  }));

  const routerNodes: TopologyNode[] = routers.map((r) => ({
    id: r.id,
    name: r.name,
    type: 'router',
    status: r.status,
    ip: r.ip,
    meta: { model: r.model, source: r.source, connectedClients: r.connectedClients, error: r.error },
    children: [
      ...(devicesByRouter[r.id] ?? []).map((d): TopologyNode => ({
        id: d.id,
        name: d.name,
        type: 'device',
        status: 'online',
        ip: d.ip,
        meta: { mac: d.mac, connection: d.connection, signal: d.signal },
        children: [],
      })),
      // Cameras are placed under the Huawei gateway (main router)
      ...(r.id === 'huawei' ? cameraNodes : []),
    ],
  }));

  return {
    id: 'internet',
    name: 'Internet',
    type: 'internet',
    status: 'online',
    children: routerNodes,
  };
}

// ---------------------------------------------------------------------------
// Main aggregator
// ---------------------------------------------------------------------------

export async function getNetworkTopology(): Promise<NetworkTopology> {
  const startMs = Date.now();
  console.info('[aggregator] ═══ starting network poll (%s) ═══', new Date().toISOString());

  // All fetches run concurrently — failure of one never blocks the others
  const [huaweiResult, n301Result, f3Result, dlinkResult, cameraResult] = await Promise.all([
    safeHuawei(),
    safeTendaN301(),
    safeTendaF3(),
    safeDlink(),
    safeCamera(),
  ]);

  const huaweiRouter = huaweiToRouter(huaweiResult.data, huaweiResult.error);
  const n301Router   = tendaToRouter(n301Result.data, 'tenda-n301', n301Result.error);
  const f3Router     = tendaToRouter(f3Result.data,   'tenda-f3',   f3Result.error);
  const dlinkRouter  = dlinkToRouter(dlinkResult.data, dlinkResult.error);

  const routers: NormalisedRouter[] = [huaweiRouter, n301Router, f3Router, dlinkRouter];

  const devices: NormalisedDevice[] = [
    ...huaweiDevicesToNormalised(huaweiResult.data.devices, 'huawei', huaweiRouter.name),
    ...tendaDevicesToNormalised(n301Result.data.devices, 'tenda-n301', n301Router.name),
    ...tendaDevicesToNormalised(f3Result.data.devices, 'tenda-f3', f3Router.name),
    ...dlinkDevicesToNormalised(dlinkResult.data.devices, 'dlink-x1852e', dlinkRouter.name),
  ];

  const cameras: NormalisedCamera[] = [
    cameraToNormalised(cameraResult.data, cameraResult.error),
  ];

  const onlineRouters = routers.filter((r) => r.status === 'online').length;

  console.info(
    '[aggregator] ═══ poll complete in %dms — %d/%d routers online, %d device(s), %d camera(s) ═══',
    Date.now() - startMs, onlineRouters, routers.length, devices.length, cameras.length,
  );

  return {
    fetchedAt: new Date().toISOString(),
    summary: {
      totalRouters: routers.length,
      onlineRouters,
      totalDevices: devices.length,
      totalCameras: cameras.length,
    },
    routers,
    devices,
    cameras,
    topology: buildTopology(routers, devices, cameras),
  };
}

/** Convenience: just get all routers */
export async function getAllRouters(): Promise<NormalisedRouter[]> {
  const topo = await getNetworkTopology();
  return topo.routers;
}

/** Convenience: just get all devices */
export async function getAllDevices(): Promise<NormalisedDevice[]> {
  const topo = await getNetworkTopology();
  return topo.devices;
}

/** Convenience: just get all cameras */
export async function getAllCameras(): Promise<NormalisedCamera[]> {
  const topo = await getNetworkTopology();
  return topo.cameras;
}
