import { create } from 'zustand';
import { Router, RouterStats, RouterLog } from '@/types/router';
import { api } from '@/lib/api';

interface RouterState {
  routers: Router[];
  selectedRouter: Router | null;
  routerStats: RouterStats[];
  routerLogs: RouterLog[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchRouters: () => Promise<void>;
  fetchRouter: (id: string) => Promise<void>;
  fetchRouterStats: (id: string, hours?: number) => Promise<void>;
  fetchRouterLogs: (id: string, limit?: number) => Promise<void>;
  rebootRouter: (id: string) => Promise<void>;
  updateRouter: (id: string, data: Partial<Router>) => void;
  selectRouter: (router: Router | null) => void;
  clearError: () => void;
}

export const useRouterStore = create<RouterState>((set, get) => ({
  routers: [],
  selectedRouter: null,
  routerStats: [],
  routerLogs: [],
  loading: false,
  error: null,

  fetchRouters: async () => {
    set({ loading: true, error: null });
    try {
      const routers = await api.getRouters();
      set({ routers, loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch routers', loading: false });
    }
  },

  fetchRouter: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const router = await api.getRouter(id);
      set({ selectedRouter: router, loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch router details', loading: false });
    }
  },

  fetchRouterStats: async (id: string, hours = 24) => {
    try {
      const stats = await api.getRouterStats(id, hours);
      set({ routerStats: stats });
    } catch (error) {
      console.error('Failed to fetch router stats:', error);
    }
  },

  fetchRouterLogs: async (id: string, limit = 100) => {
    try {
      const logs = await api.getRouterLogs(id, limit);
      set({ routerLogs: logs });
    } catch (error) {
      console.error('Failed to fetch router logs:', error);
    }
  },

  rebootRouter: async (id: string) => {
    try {
      await api.rebootRouter(id);
      // Update router status to indicate rebooting
      const { routers } = get();
      set({
        routers: routers.map((r) =>
          r.id === id ? { ...r, status: 'offline' as const } : r
        ),
      });
    } catch (error) {
      set({ error: 'Failed to reboot router' });
    }
  },

  updateRouter: (id: string, data: Partial<Router>) => {
    const { routers } = get();
    set({
      routers: routers.map((r) =>
        r.id === id ? { ...r, ...data } : r
      ),
    });
  },

  selectRouter: (router: Router | null) => {
    set({ selectedRouter: router });
  },

  clearError: () => set({ error: null }),
}));
