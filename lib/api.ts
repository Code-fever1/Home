import axios, { AxiosInstance, AxiosError } from 'axios';
import { Router, RouterStats, WiFiSettings, RouterLog } from '@/types/router';
import { Device, DeviceDetails } from '@/types/device';
import { NetworkStatus, BandwidthData, NetworkEvent } from '@/types/network';
import { mockRouters, mockDevices, mockNetworkStatus, generateBandwidthHistory, mockNetworkEvents } from './mockData';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const USE_MOCK_DATA = true;

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    this.client.interceptors.request.use(
      (config) => {
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
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: { id: string; email: string; name: string } }> {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async logout(): Promise<void> {
    localStorage.removeItem('auth_token');
  }

  // Routers
  async getRouters(): Promise<Router[]> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockRouters;
    }
    const response = await this.client.get('/routers');
    return response.data;
  }

  async getRouter(id: string): Promise<Router> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const router = mockRouters.find(r => r.id === id);
      if (!router) throw new Error('Router not found');
      return router;
    }
    const response = await this.client.get(`/routers/${id}`);
    return response.data;
  }

  async getRouterStats(id: string, hours = 24): Promise<RouterStats[]> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return generateBandwidthHistory().map(d => ({
        timestamp: d.timestamp,
        cpuUsage: Math.floor(Math.random() * 60) + 20,
        memoryUsage: Math.floor(Math.random() * 50) + 30,
        bandwidthIn: d.download,
        bandwidthOut: d.upload,
      }));
    }
    const response = await this.client.get(`/routers/${id}/stats`, { params: { hours } });
    return response.data;
  }

  async getRouterLogs(id: string, limit = 100): Promise<RouterLog[]> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return [
        { id: 'log-1', routerId: id, timestamp: new Date().toISOString(), level: 'info', message: 'System startup complete', source: 'system' },
        { id: 'log-2', routerId: id, timestamp: new Date(Date.now() - 60000).toISOString(), level: 'info', message: 'DHCP lease assigned to 192.168.1.101', source: 'dhcp' },
        { id: 'log-3', routerId: id, timestamp: new Date(Date.now() - 120000).toISOString(), level: 'warning', message: 'High memory usage detected', source: 'monitor' },
      ];
    }
    const response = await this.client.get(`/routers/${id}/logs`, { params: { limit } });
    return response.data;
  }

  async rebootRouter(id: string): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }
    await this.client.post(`/routers/${id}/reboot`);
  }

  async updateWiFiSettings(id: string, settings: WiFiSettings): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return;
    }
    await this.client.put(`/routers/${id}/wifi`, settings);
  }

  // Devices
  async getDevices(): Promise<Device[]> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockDevices.map(d => ({
        ...d,
        routerName: mockRouters.find(r => r.id === d.routerId)?.name,
      }));
    }
    const response = await this.client.get('/devices');
    return response.data;
  }

  async getDevice(id: string): Promise<DeviceDetails> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const device = mockDevices.find(d => d.id === id);
      if (!device) throw new Error('Device not found');
      return {
        ...device,
        routerName: mockRouters.find(r => r.id === device.routerId)?.name,
        history: generateBandwidthHistory().slice(-24).map(d => ({
          timestamp: d.timestamp,
          bandwidthIn: d.download,
          bandwidthOut: d.upload,
          latency: Math.floor(Math.random() * 20) + 5,
        })),
        openPorts: [80, 443, 8080],
        os: 'iOS',
        osVersion: '17.1',
      };
    }
    const response = await this.client.get(`/devices/${id}`);
    return response.data;
  }

  async blockDevice(id: string): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return;
    }
    await this.client.post(`/devices/${id}/block`);
  }

  async unblockDevice(id: string): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return;
    }
    await this.client.post(`/devices/${id}/unblock`);
  }

  async renameDevice(id: string, name: string): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return;
    }
    await this.client.put(`/devices/${id}`, { name });
  }

  // Network
  async getNetworkStatus(): Promise<NetworkStatus> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return mockNetworkStatus;
    }
    const response = await this.client.get('/network/status');
    return response.data;
  }

  async getBandwidthHistory(hours = 24): Promise<BandwidthData[]> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return generateBandwidthHistory();
    }
    const response = await this.client.get('/network/bandwidth', { params: { hours } });
    return response.data;
  }

  async getNetworkEvents(limit = 50): Promise<NetworkEvent[]> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return mockNetworkEvents.slice(0, limit);
    }
    const response = await this.client.get('/network/events', { params: { limit } });
    return response.data;
  }
}

export const api = new ApiClient();
