import axios, { AxiosError, AxiosInstance } from 'axios';
import { Router, RouterLog, RouterStats, WiFiSettings } from '@/types/router';
import { Device, DeviceDetails, DeviceType } from '@/types/device';
import { BandwidthData, NetworkEvent, NetworkStatus } from '@/types/network';

type ApiRouter = {
  id: string;
  name: string;
  model: string;
  ip: string;
  status: 'online' | 'offline';
  connectedClients: number;
  fetchedAt: string;
  wanIp?: string;
};

type ApiDevice = {
  id: string;
  name: string;
  ip: string;
  mac: string;
  connection: 'wifi' | 'ethernet' | 'unknown';
  routerId: string;
  routerName: string;
  signal?: number;
};

type ApiTopology = {
  fetchedAt: string;
  summary: {
    totalRouters: number;
    onlineRouters: number;
    totalDevices: number;
  };
  routers: ApiRouter[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

function inferDeviceType(name: string): DeviceType {
  const lower = name.toLowerCase();
  if (/iphone|android|mobile|phone|vivo|oppo|tecno|galaxy/.test(lower)) return 'smartphone';
  if (/macbook|laptop|notebook/.test(lower)) return 'laptop';
  if (/desktop|pc|workstation/.test(lower)) return 'desktop';
  if (/ipad|tablet/.test(lower)) return 'tablet';
  if (/tv|chromecast|roku|fire/.test(lower)) return 'smart_tv';
  if (/camera|cam|cctv/.test(lower)) return 'camera';
  if (/printer/.test(lower)) return 'printer';
  if (/iot|sensor|smart/.test(lower)) return 'iot';
  return 'other';
}

function mapRouter(router: ApiRouter): Router {
  return {
    id: router.id,
    name: router.name,
    model: router.model,
    ipAddress: router.ip,
    macAddress: '',
    status: router.status === 'online' ? 'online' : 'offline',
    firmwareVersion: 'unknown',
    cpuUsage: 0,
    memoryUsage: 0,
    connectedClients: router.connectedClients,
    uptime: 0,
    lastSeen: router.fetchedAt || new Date().toISOString(),
  };
}

function mapDevice(device: ApiDevice, fetchedAt: string): Device {
  return {
    id: device.id,
    name: device.name,
    macAddress: device.mac,
    ipAddress: device.ip,
    deviceType: inferDeviceType(device.name),
    connectionType: device.connection === 'wifi' ? 'wifi' : 'ethernet',
    routerId: device.routerId,
    routerName: device.routerName,
    status: 'online',
    bandwidthIn: 0,
    bandwidthOut: 0,
    firstSeen: fetchedAt,
    lastSeen: fetchedAt,
    isBlocked: false,
    signalStrength: device.signal,
  };
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    this.client.interceptors.request.use(
      (config) => {
        if (typeof window === 'undefined') return config;
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (typeof window !== 'undefined' && error.response?.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async login(email: string, password: string): Promise<{ token: string; user: { id: string; email: string; name: string } }> {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async logout(): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  async getRouters(): Promise<Router[]> {
    const response = await this.client.get('/network/routers');
    const routers = (response.data.routers || []) as ApiRouter[];
    return routers.map(mapRouter);
  }

  async getRouter(id: string): Promise<Router> {
    const routers = await this.getRouters();
    const router = routers.find((entry) => entry.id === id);
    if (!router) throw new Error('Router not found');
    return router;
  }

  async getRouterStats(_id: string, _hours = 24): Promise<RouterStats[]> {
    return [];
  }

  async getRouterLogs(_id: string, _limit = 100): Promise<RouterLog[]> {
    return [];
  }

  async rebootRouter(id: string): Promise<void> {
    await this.client.post(`/routers/${id}/reboot`);
  }

  async updateWiFiSettings(id: string, settings: WiFiSettings): Promise<void> {
    await this.client.put(`/routers/${id}/wifi`, settings);
  }

  async getDevices(): Promise<Device[]> {
    const response = await this.client.get('/network/devices');
    const fetchedAt = response.data.fetchedAt || new Date().toISOString();
    const devices = (response.data.devices || []) as ApiDevice[];
    return devices.map((device) => mapDevice(device, fetchedAt));
  }

  async getDevice(id: string): Promise<DeviceDetails> {
    const devices = await this.getDevices();
    const device = devices.find((entry) => entry.id === id);
    if (!device) throw new Error('Device not found');
    return {
      ...device,
      history: [],
      openPorts: [],
    };
  }

  async blockDevice(id: string): Promise<void> {
    await this.client.post(`/devices/${id}/block`);
  }

  async unblockDevice(id: string): Promise<void> {
    await this.client.post(`/devices/${id}/unblock`);
  }

  async renameDevice(id: string, name: string): Promise<void> {
    await this.client.put(`/devices/${id}`, { name });
  }

  async getNetworkStatus(): Promise<NetworkStatus> {
    const response = await this.client.get('/network/topology');
    const topology = response.data as ApiTopology;
    const gateway = topology.routers?.[0]?.ip?.replace(/^https?:\/\//, '') || 'unknown';
    const wanIp = topology.routers?.find((router) => router.wanIp)?.wanIp;
    const onlineRouters = topology.summary?.onlineRouters || 0;

    return {
      status: onlineRouters > 0 ? 'online' : 'offline',
      wanIp,
      gateway,
      dns: [],
      internetSpeed: { download: 0, upload: 0, ping: 0 },
      totalBandwidth: { download: 0, upload: 0 },
      activeDevices: topology.summary?.totalDevices || 0,
      totalDevices: topology.summary?.totalDevices || 0,
      activeRouters: onlineRouters,
      totalRouters: topology.summary?.totalRouters || 0,
    };
  }

  async getBandwidthHistory(_hours = 24): Promise<BandwidthData[]> {
    return [];
  }

  async getNetworkEvents(_limit = 50): Promise<NetworkEvent[]> {
    return [];
  }
}

export const api = new ApiClient();

