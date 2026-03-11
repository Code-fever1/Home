export type DeviceType = 'smartphone' | 'laptop' | 'desktop' | 'tablet' | 'smart_tv' | 'iot' | 'camera' | 'printer' | 'other';
export type ConnectionType = 'wifi' | 'ethernet' | 'mesh';

export interface Device {
  id: string;
  name: string;
  hostname?: string;
  macAddress: string;
  ipAddress: string;
  deviceType: DeviceType;
  connectionType: ConnectionType;
  routerId: string;
  routerName?: string;
  status: 'online' | 'offline' | 'blocked';
  bandwidthIn: number;
  bandwidthOut: number;
  firstSeen: string;
  lastSeen: string;
  vendor?: string;
  isBlocked: boolean;
  signalStrength?: number;
}

export interface DeviceStats {
  timestamp: string;
  bandwidthIn: number;
  bandwidthOut: number;
  latency?: number;
}

export interface DeviceDetails extends Device {
  history: DeviceStats[];
  openPorts?: number[];
  os?: string;
  osVersion?: string;
}
