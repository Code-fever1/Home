/**
 * IP Camera service — SERVER SIDE ONLY.
 *
 * Supports common IP camera HTTP APIs:
 *   - ONVIF-style endpoints (/onvif/device_service)
 *   - Generic CGI endpoints (/cgi-bin/snapshot.cgi, /videostream.cgi)
 *   - JSON status endpoints (/api/v1/status, /status.json)
 *   - Hikvision-style (/ISAPI/System/deviceInfo)
 *   - Dahua-style (/cgi-bin/magicBox.cgi)
 *
 * Falls back to a mock response if the camera is unreachable.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { devicesConfig } from '@/lib/config';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type CameraErrorKind =
  | 'offline'
  | 'auth_failed'
  | 'timeout'
  | 'invalid_credentials'
  | 'unknown';

export class CameraError extends Error {
  constructor(
    public readonly kind: CameraErrorKind,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'CameraError';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CameraStatus {
  device: string;
  ip: string;
  status: 'online' | 'offline' | 'unknown';
  model?: string;
  firmwareVersion?: string;
  streamUrl: string;
  snapshotUrl: string;
  motionDetected: boolean;
  uptime?: number;
  source: 'live' | 'mock';
  fetchedAt: string;
  error?: { kind: string; message: string };
}

// ---------------------------------------------------------------------------
// HTTP client (uses HTTP Basic Auth — standard for IP cameras)
// ---------------------------------------------------------------------------

function createHttpClient(baseURL: string, username: string, password: string, timeout: number): AxiosInstance {
  return axios.create({
    baseURL,
    timeout,
    auth: { username, password },
    validateStatus: (status) => status < 500,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/json,*/*',
    },
  });
}

// ---------------------------------------------------------------------------
// Probe available endpoints
// ---------------------------------------------------------------------------

/** Returns the first responding endpoint or null */
async function probeEndpoint(client: AxiosInstance, paths: string[]): Promise<{ path: string; data: unknown } | null> {
  for (const path of paths) {
    try {
      const res = await client.get(path);
      if (res.status === 200) return { path, data: res.data };
    } catch {
      // try next
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

async function fetchCameraStatus(client: AxiosInstance, ip: string): Promise<Partial<CameraStatus>> {
  // Try JSON-based status endpoints first
  const jsonEndpoints = [
    '/api/v1/status',
    '/status.json',
    '/cgi-bin/status.cgi',
    '/ISAPI/System/deviceInfo',
    '/cgi-bin/magicBox.cgi?action=getProductDefinition',
  ];

  const result = await probeEndpoint(client, jsonEndpoints);

  if (result) {
    const data = result.data;
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      return {
        model: String(obj.model ?? obj.deviceType ?? obj.Model ?? 'IP Camera'),
        firmwareVersion: String(obj.firmware ?? obj.firmwareVersion ?? obj.FirmwareVersion ?? 'unknown'),
        uptime: Number(obj.uptime ?? 0),
        motionDetected: Boolean(obj.motionDetected ?? obj.motion ?? false),
      };
    }

    if (typeof data === 'string' && data.includes('model')) {
      const modelMatch = /model[=>\s:"]+([^\s<&"]+)/.exec(data);
      return { model: modelMatch?.[1] ?? 'IP Camera', motionDetected: false };
    }
  }

  // Fallback: just try GET / to confirm reachability
  try {
    const res = await client.get('/');
    if (res.status === 200 || res.status === 401) {
      return { status: 'online', motionDetected: false };
    }
  } catch {
    // ignore
  }

  return {};
}

// ---------------------------------------------------------------------------
// Stream URL resolution
// ---------------------------------------------------------------------------

/** Build likely RTSP and HTTP stream URLs for common camera firmware. */
function buildStreamUrls(ip: string): { stream: string; snapshot: string } {
  // Strip protocol — RTSP is always on the raw host
  const host = ip.replace(/^https?:\/\//, '');

  return {
    // Common RTSP paths
    stream: `rtsp://${host}/stream`,
    // Common HTTP snapshot paths (used for live preview in browser)
    snapshot: `${ip}/snapshot.jpg`,
  };
}

// ---------------------------------------------------------------------------
// Motion detection
// ---------------------------------------------------------------------------

async function fetchMotionStatus(client: AxiosInstance): Promise<boolean> {
  const motionEndpoints = [
    '/cgi-bin/motion.cgi',
    '/api/v1/motion',
    '/ISAPI/System/Video/channels/1/motionDetection',
  ];

  for (const endpoint of motionEndpoints) {
    try {
      const res = await client.get(endpoint);
      if (res.status === 200) {
        const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        if (/motion.*true|detected.*true|triggered.*1/i.test(body)) return true;
        return false;
      }
    } catch {
      // try next
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Error classifier
// ---------------------------------------------------------------------------

function classifyError(err: unknown): CameraError {
  const axiosErr = err as AxiosError;
  if (axiosErr.isAxiosError) {
    if (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ENOTFOUND') {
      return new CameraError('offline', 'Camera is unreachable', err);
    }
    if (axiosErr.code === 'ETIMEDOUT' || axiosErr.code === 'ECONNABORTED') {
      return new CameraError('timeout', 'Camera request timed out', err);
    }
    if (axiosErr.response?.status === 401 || axiosErr.response?.status === 403) {
      return new CameraError('invalid_credentials', 'Invalid camera credentials', err);
    }
  }
  return new CameraError('unknown', String(err), err);
}

// ---------------------------------------------------------------------------
// Mock fallback
// ---------------------------------------------------------------------------

export function getMockCameraStatus(): CameraStatus {
  const ip = devicesConfig.camera.ip;
  const { stream, snapshot } = buildStreamUrls(ip);

  return {
    device: 'IP Camera',
    ip,
    status: 'offline',
    model: 'Generic IP Camera',
    firmwareVersion: 'unknown',
    streamUrl: stream,
    snapshotUrl: snapshot,
    motionDetected: false,
    uptime: 0,
    source: 'mock',
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getCameraStatus(): Promise<CameraStatus> {
  const { ip, username, password, timeout } = devicesConfig.camera;
  const { stream, snapshot } = buildStreamUrls(ip);

  const client = createHttpClient(ip, username, password, timeout);

  try {
    const [partial, motionDetected] = await Promise.all([
      fetchCameraStatus(client, ip),
      fetchMotionStatus(client),
    ]);

    return {
      device: 'IP Camera',
      ip,
      status: 'online',
      model: partial.model ?? 'IP Camera',
      firmwareVersion: partial.firmwareVersion ?? 'unknown',
      streamUrl: stream,
      snapshotUrl: snapshot,
      motionDetected: partial.motionDetected ?? motionDetected,
      uptime: partial.uptime ?? 0,
      source: 'live',
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    const cameraErr = classifyError(err);
    console.warn(`[camera] ${cameraErr.kind}: ${cameraErr.message}`);
    throw cameraErr;
  }
}

export async function getStreamURL(): Promise<string> {
  return buildStreamUrls(devicesConfig.camera.ip).stream;
}

export async function getSnapshotURL(): Promise<string> {
  return buildStreamUrls(devicesConfig.camera.ip).snapshot;
}

export async function getMotionStatus(): Promise<boolean> {
  const { ip, username, password, timeout } = devicesConfig.camera;
  const client = createHttpClient(ip, username, password, timeout);
  return fetchMotionStatus(client);
}
