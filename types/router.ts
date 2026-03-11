export interface Router {
  id: string;
  name: string;
  model: string;
  ipAddress: string;
  macAddress: string;
  status: 'online' | 'offline' | 'warning';
  firmwareVersion: string;
  cpuUsage: number;
  memoryUsage: number;
  signalStrength?: number;
  ssid?: string;
  ssid5g?: string;
  connectedClients: number;
  uptime: number;
  location?: string;
  lastSeen: string;
}

export interface RouterStats {
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  bandwidthIn: number;
  bandwidthOut: number;
}

export interface WiFiSettings {
  ssid: string;
  password: string;
  ssid5g?: string;
  password5g?: string;
  channel: number;
  channelWidth: string;
  encryption: string;
  hidden: boolean;
}

export interface RouterLog {
  id: string;
  routerId: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  source: string;
}
