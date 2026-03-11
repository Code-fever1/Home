export interface NetworkStatus {
  status: 'online' | 'offline' | 'degraded';
  wanIp?: string;
  gateway: string;
  dns: string[];
  internetSpeed: {
    download: number;
    upload: number;
    ping: number;
  };
  totalBandwidth: {
    download: number;
    upload: number;
  };
  activeDevices: number;
  totalDevices: number;
  activeRouters: number;
  totalRouters: number;
}

export interface BandwidthData {
  timestamp: string;
  download: number;
  upload: number;
}

export interface NetworkTopology {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

export interface NetworkNode {
  id: string;
  type: 'internet' | 'router' | 'device';
  label: string;
  status: 'online' | 'offline' | 'warning';
  ip?: string;
  mac?: string;
  x?: number;
  y?: number;
}

export interface NetworkLink {
  source: string;
  target: string;
  type: 'ethernet' | 'wifi' | 'mesh';
  strength?: number;
}

export interface NetworkEvent {
  id: string;
  timestamp: string;
  type: 'device_connected' | 'device_disconnected' | 'router_offline' | 'router_online' | 'bandwidth_spike' | 'security_alert';
  severity: 'info' | 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
}
