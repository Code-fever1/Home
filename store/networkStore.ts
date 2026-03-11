import { create } from 'zustand';
import { NetworkStatus, BandwidthData, NetworkEvent, NetworkTopology } from '@/types/network';
import { api } from '@/lib/api';

interface NetworkState {
  status: NetworkStatus | null;
  bandwidthHistory: BandwidthData[];
  events: NetworkEvent[];
  topology: NetworkTopology | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchNetworkStatus: () => Promise<void>;
  fetchBandwidthHistory: (hours?: number) => Promise<void>;
  fetchNetworkEvents: (limit?: number) => Promise<void>;
  addBandwidthData: (data: BandwidthData) => void;
  addNetworkEvent: (event: NetworkEvent) => void;
  updateNetworkStatus: (status: Partial<NetworkStatus>) => void;
  clearError: () => void;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  status: null,
  bandwidthHistory: [],
  events: [],
  topology: null,
  loading: false,
  error: null,

  fetchNetworkStatus: async () => {
    set({ loading: true, error: null });
    try {
      const status = await api.getNetworkStatus();
      set({ status, loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch network status', loading: false });
    }
  },

  fetchBandwidthHistory: async (hours = 24) => {
    try {
      const history = await api.getBandwidthHistory(hours);
      set({ bandwidthHistory: history });
    } catch (error) {
      console.error('Failed to fetch bandwidth history:', error);
    }
  },

  fetchNetworkEvents: async (limit = 50) => {
    try {
      const events = await api.getNetworkEvents(limit);
      set({ events });
    } catch (error) {
      console.error('Failed to fetch network events:', error);
    }
  },

  addBandwidthData: (data: BandwidthData) => {
    const { bandwidthHistory } = get();
    // Keep last 100 data points
    const newHistory = [...bandwidthHistory, data].slice(-100);
    set({ bandwidthHistory: newHistory });
  },

  addNetworkEvent: (event: NetworkEvent) => {
    const { events } = get();
    set({ events: [event, ...events].slice(0, 100) });
  },

  updateNetworkStatus: (update: Partial<NetworkStatus>) => {
    const { status } = get();
    if (status) {
      set({ status: { ...status, ...update } });
    }
  },

  clearError: () => set({ error: null }),
}));
