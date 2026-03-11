import { create } from 'zustand';
import { Device, DeviceDetails } from '@/types/device';
import { api } from '@/lib/api';

interface DeviceState {
  devices: Device[];
  selectedDevice: DeviceDetails | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchDevices: () => Promise<void>;
  fetchDevice: (id: string) => Promise<void>;
  blockDevice: (id: string) => Promise<void>;
  unblockDevice: (id: string) => Promise<void>;
  renameDevice: (id: string, name: string) => Promise<void>;
  updateDeviceStatus: (id: string, status: Device['status']) => void;
  addDevice: (device: Device) => void;
  removeDevice: (id: string) => void;
  selectDevice: (device: DeviceDetails | null) => void;
  clearError: () => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  selectedDevice: null,
  loading: false,
  error: null,

  fetchDevices: async () => {
    set({ loading: true, error: null });
    try {
      const devices = await api.getDevices();
      set({ devices, loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch devices', loading: false });
    }
  },

  fetchDevice: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const device = await api.getDevice(id);
      set({ selectedDevice: device, loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch device details', loading: false });
    }
  },

  blockDevice: async (id: string) => {
    try {
      await api.blockDevice(id);
      const { devices, selectedDevice } = get();
      set({
        devices: devices.map((d) =>
          d.id === id ? { ...d, status: 'blocked', isBlocked: true } : d
        ),
        selectedDevice: selectedDevice?.id === id
          ? { ...selectedDevice, status: 'blocked', isBlocked: true }
          : selectedDevice,
      });
    } catch (error) {
      set({ error: 'Failed to block device' });
    }
  },

  unblockDevice: async (id: string) => {
    try {
      await api.unblockDevice(id);
      const { devices, selectedDevice } = get();
      set({
        devices: devices.map((d) =>
          d.id === id ? { ...d, status: 'online', isBlocked: false } : d
        ),
        selectedDevice: selectedDevice?.id === id
          ? { ...selectedDevice, status: 'online', isBlocked: false }
          : selectedDevice,
      });
    } catch (error) {
      set({ error: 'Failed to unblock device' });
    }
  },

  renameDevice: async (id: string, name: string) => {
    try {
      await api.renameDevice(id, name);
      const { devices, selectedDevice } = get();
      set({
        devices: devices.map((d) =>
          d.id === id ? { ...d, name } : d
        ),
        selectedDevice: selectedDevice?.id === id
          ? { ...selectedDevice, name }
          : selectedDevice,
      });
    } catch (error) {
      set({ error: 'Failed to rename device' });
    }
  },

  updateDeviceStatus: (id: string, status: Device['status']) => {
    const { devices } = get();
    set({
      devices: devices.map((d) =>
        d.id === id ? { ...d, status } : d
      ),
    });
  },

  addDevice: (device: Device) => {
    const { devices } = get();
    if (!devices.find((d) => d.id === device.id)) {
      set({ devices: [...devices, device] });
    }
  },

  removeDevice: (id: string) => {
    const { devices } = get();
    set({ devices: devices.filter((d) => d.id !== id) });
  },

  selectDevice: (device: DeviceDetails | null) => {
    set({ selectedDevice: device });
  },

  clearError: () => set({ error: null }),
}));
