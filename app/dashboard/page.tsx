'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sidebar } from '@/components/custom/Sidebar';
import { TopNavbar } from '@/components/custom/TopNavbar';
import { BandwidthChart } from '@/components/custom/BandwidthChart';
import {
  Router,
  Wifi,
  Monitor,
  AlertCircle,
  Activity,
  RefreshCw,
  Laptop,
  Smartphone,
  Tv,
  Camera,
  Signal,
  Globe,
  Server,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useNetworkStore } from '@/store/networkStore';
import { useWebSocket } from '@/lib/websocket';
import { NetworkEvent } from '@/types/network';
import type { NetworkTopology, NormalisedRouter, NormalisedDevice, NormalisedCamera } from '@/lib/network/aggregator';

// ---------------------------------------------------------------------------
// Hook: poll /api/network/topology every 30 s
// ---------------------------------------------------------------------------
function useNetworkTopology(pollIntervalMs = 30_000) {
  const [data, setData] = useState<NetworkTopology | null>(null);
  const [loading, setLoading] = useState(true);

  const doFetch = useCallback(async () => {
    try {
      const res = await window.fetch('/api/network/topology');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    doFetch();
    const id = setInterval(doFetch, pollIntervalMs);
    return () => clearInterval(id);
  }, [doFetch, pollIntervalMs]);

  return { data, loading, refresh: doFetch };
}

// ---------------------------------------------------------------------------
// Small helper components
// ---------------------------------------------------------------------------

function DeviceIcon({ name, connection }: { name: string; connection: string }) {
  const lower = name.toLowerCase();
  if (/phone|iphone|android|mobile/i.test(lower))
    return <Smartphone className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
  if (/tv|television|chromecast|roku|fire/i.test(lower))
    return <Tv className="h-3.5 w-3.5 text-purple-400 shrink-0" />;
  if (connection === 'ethernet')
    return <Server className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
  return <Laptop className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
}

// ---------------------------------------------------------------------------
// RouterSection â€” one card per router + its devices
// ---------------------------------------------------------------------------
function RouterSection({
  router,
  devices,
}: {
  router: NormalisedRouter;
  devices: NormalisedDevice[];
}) {
  const [collapsed, setCollapsed] = useState(false);

  const statusColor =
    router.status === 'online'
      ? 'text-emerald-400 border-emerald-500/40'
      : 'text-red-400 border-red-500/40';

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Router className="h-4 w-4 text-blue-500 shrink-0" />
            <CardTitle className="text-sm font-semibold text-slate-100">{router.name}</CardTitle>
            <span className="text-xs text-slate-500">{router.model}</span>
            <Badge variant="outline" className={`text-[10px] px-1.5 ${statusColor}`}>
              {router.status.toUpperCase()}
            </Badge>
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Toggle devices"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>

        {router.error && (
          <div className="mt-1.5 flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-300">{router.error.message}</p>
          </div>
        )}

        <p className="text-xs text-slate-500 mt-0.5">
          {router.ip}
          {router.wanIp && router.wanIp !== 'unknown' && (
            <span className="ml-2 text-slate-600">WAN: {router.wanIp}</span>
          )}
          <span className="ml-2">{router.connectedClients} client{router.connectedClients !== 1 ? 's' : ''}</span>
        </p>
      </CardHeader>

      {!collapsed && devices.length > 0 && (
        <CardContent className="pt-0">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map((d) => (
              <div
                key={d.id}
                className="flex items-start gap-2.5 rounded-lg bg-slate-800/50 border border-slate-700/40 px-3 py-2 hover:border-slate-600 transition-colors"
              >
                <DeviceIcon name={d.name} connection={d.connection} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-200 truncate">{d.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{d.ip}</p>
                  <p className="text-[10px] text-slate-600 font-mono">{d.mac}</p>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    {d.connection === 'wifi' ? (
                      <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-[9px] px-1 py-0">
                        <Wifi className="w-2 h-2 mr-1 inline" />WiFi
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-slate-500/30 text-slate-400 text-[9px] px-1 py-0">
                        Ethernet
                      </Badge>
                    )}
                    {d.signal !== undefined && (
                      <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                        <Signal className="w-2 h-2" />{d.signal} dBm
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}

      {!collapsed && devices.length === 0 && (
        <CardContent className="pt-0">
          <p className="text-xs text-slate-600 italic">No devices detected.</p>
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CameraSection
// ---------------------------------------------------------------------------
function CameraSection({ cameras }: { cameras: NormalisedCamera[] }) {
  if (cameras.length === 0) return null;

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <Camera className="h-4 w-4 text-purple-400" />
          Cameras
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cameras.map((cam) => (
            <div
              key={cam.id}
              className="rounded-lg bg-slate-800/50 border border-slate-700/40 p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-200">{cam.device}</span>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={
                      cam.status === 'online'
                        ? 'border-emerald-500/40 text-emerald-400 text-[9px] px-1.5'
                        : 'border-red-500/40 text-red-400 text-[9px] px-1.5'
                    }
                  >
                    {cam.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 font-mono">{cam.ip}</p>
              {cam.model && <p className="text-[10px] text-slate-600">{cam.model}</p>}

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {cam.motionDetected && (
                  <Badge variant="outline" className="border-orange-500/40 text-orange-400 text-[9px] px-1.5">
                    Motion detected
                  </Badge>
                )}
                <a
                  href={cam.streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] text-blue-400 hover:underline"
                >
                  RTSP Stream
                </a>
              </div>

              {cam.error && (
                <p className="mt-1.5 text-[10px] text-amber-400">{cam.error.message}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Topology tree visualiser
// ---------------------------------------------------------------------------
type TopoNode = {
  id: string;
  name: string;
  type: string;
  status: string;
  ip?: string;
  meta?: Record<string, unknown>;
  children: TopoNode[];
};

function TopologyTree({ node, depth = 0 }: { node: TopoNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);

  const icon =
    node.type === 'internet' ? <Globe className="h-3.5 w-3.5 text-cyan-400 shrink-0" /> :
    node.type === 'router' ? <Router className="h-3.5 w-3.5 text-blue-400 shrink-0" /> :
    node.type === 'camera' ? <Camera className="h-3.5 w-3.5 text-purple-400 shrink-0" /> :
    <Monitor className="h-3.5 w-3.5 text-slate-400 shrink-0" />;

  const statusDot =
    node.status === 'online' ? 'bg-emerald-500' :
    node.status === 'offline' ? 'bg-red-500' : 'bg-amber-500';

  const hasChildren = node.children.length > 0;

  return (
    <div className={depth > 0 ? 'ml-5 border-l border-slate-800 pl-3' : ''}>
      <div
        className={`flex items-center gap-2 py-1 ${hasChildren ? 'cursor-pointer' : ''} hover:bg-slate-800/30 rounded px-1 transition-colors`}
        onClick={() => hasChildren && setOpen((o) => !o)}
      >
        {hasChildren ? (
          open ? <ChevronDown className="h-3 w-3 text-slate-500 shrink-0" /> : <ChevronRight className="h-3 w-3 text-slate-500 shrink-0" />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {icon}
        <span className="text-xs text-slate-300 truncate">{node.name}</span>
        {node.ip && <span className="text-[10px] text-slate-600 font-mono hidden sm:inline">{node.ip}</span>}
        <span className={`ml-auto h-1.5 w-1.5 rounded-full ${statusDot} shrink-0`} />
      </div>

      {open && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TopologyTree key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard content
// ---------------------------------------------------------------------------
function DashboardContent() {
  const { bandwidthHistory, fetchNetworkStatus, addBandwidthData, addNetworkEvent } =
    useNetworkStore();
  const { data: topo, loading, refresh } = useNetworkTopology();

  useEffect(() => {
    fetchNetworkStatus();
  }, [fetchNetworkStatus]);

  useWebSocket('bandwidth_update', (data) => {
    const update = data as { timestamp: string; download: number; upload: number };
    addBandwidthData(update);
  });
  useWebSocket('network_event', (data) => {
    addNetworkEvent(data as NetworkEvent);
  });

  const totalBandwidth =
    bandwidthHistory.length > 0
      ? bandwidthHistory[bandwidthHistory.length - 1].download +
        bandwidthHistory[bandwidthHistory.length - 1].upload
      : 0;

  const devicesByRouter: Record<string, NormalisedDevice[]> = {};
  if (topo) {
    for (const d of topo.devices) {
      devicesByRouter[d.routerId] = devicesByRouter[d.routerId] ?? [];
      devicesByRouter[d.routerId].push(d);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* â”€â”€ Summary stat cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Routers</CardTitle>
            <Router className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">
              {topo?.summary.totalRouters ?? 'â€”'}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-emerald-500">{topo?.summary.onlineRouters ?? 0}</span> online
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Connected Devices</CardTitle>
            <Monitor className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">
              {topo?.summary.totalDevices ?? 'â€”'}
            </div>
            <p className="text-xs text-slate-500 mt-1">across all routers</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Cameras</CardTitle>
            <Camera className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">
              {topo?.summary.totalCameras ?? 'â€”'}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {topo?.cameras.filter((c) => c.status === 'online').length ?? 0} online
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Bandwidth</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">
              {(totalBandwidth / 1024 / 1024).toFixed(1)} MB/s
            </div>
            <p className="text-xs text-slate-500 mt-1">Network activity</p>
          </CardContent>
        </Card>
      </div>

      {/* â”€â”€ Bandwidth chart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <BandwidthChart data={bandwidthHistory} />

      {/* â”€â”€ Refresh header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
          <Signal className="h-4 w-4 text-blue-500" />
          Network Topology
          {topo && (
            <span className="text-xs text-slate-500 font-normal">
              â€” {new Date(topo.fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </h2>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && !topo && (
        <div className="text-sm text-slate-500 text-center py-10">Scanning networkâ€¦</div>
      )}

      {/* â”€â”€ Router + device cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {topo && (
        <div className="space-y-4">
          {topo.routers.map((router) => (
            <RouterSection
              key={router.id}
              router={router}
              devices={devicesByRouter[router.id] ?? []}
            />
          ))}
        </div>
      )}

      {/* â”€â”€ Camera section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {topo && <CameraSection cameras={topo.cameras} />}

      {/* â”€â”€ Topology tree â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {topo && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Globe className="h-4 w-4 text-cyan-400" />
              Network Tree
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TopologyTree node={topo.topology as TopoNode} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      <div className="lg:ml-64">
        <TopNavbar />
        <main>
          <DashboardContent />
        </main>
      </div>
    </div>
  );
}
