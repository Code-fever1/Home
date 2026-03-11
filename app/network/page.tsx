'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sidebar } from '@/components/custom/Sidebar';
import { TopNavbar } from '@/components/custom/TopNavbar';
import { NetworkMap } from '@/components/custom/NetworkMap';
import { BandwidthChart } from '@/components/custom/BandwidthChart';
import { useRouterStore } from '@/store/routerStore';
import { useDeviceStore } from '@/store/deviceStore';
import { useNetworkStore } from '@/store/networkStore';
import { Globe, ArrowUp, ArrowDown, Activity, Router, Monitor } from 'lucide-react';

function NetworkContent() {
  const { routers, fetchRouters } = useRouterStore();
  const { devices, fetchDevices } = useDeviceStore();
  const { status, bandwidthHistory, fetchNetworkStatus, fetchBandwidthHistory } = useNetworkStore();

  useEffect(() => {
    fetchRouters();
    fetchDevices();
    fetchNetworkStatus();
    fetchBandwidthHistory();
  }, [fetchRouters, fetchDevices, fetchNetworkStatus, fetchBandwidthHistory]);

  const totalDownload = bandwidthHistory.reduce((acc, curr) => acc + curr.download, 0);
  const totalUpload = bandwidthHistory.reduce((acc, curr) => acc + curr.upload, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Network Topology</h1>
        <p className="text-slate-400 mt-1">Visual overview of your network infrastructure</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Internet Status</p>
                <p className="text-lg font-semibold text-emerald-500">Connected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <ArrowDown className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Download</p>
                <p className="text-lg font-semibold text-slate-100">
                  {(totalDownload / 1024 / 1024 / 1024).toFixed(1)} GB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <ArrowUp className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Upload</p>
                <p className="text-lg font-semibold text-slate-100">
                  {(totalUpload / 1024 / 1024 / 1024).toFixed(1)} GB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Active Connections</p>
                <p className="text-lg font-semibold text-slate-100">{devices.filter(d => d.status === 'online').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NetworkMap routers={routers} devices={devices} />
        </div>

        <div className="space-y-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-100">Network Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Router className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-slate-400">Routers</span>
                </div>
                <span className="text-slate-100 font-medium">{routers.length}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm text-slate-400">Devices</span>
                </div>
                <span className="text-slate-100 font-medium">{devices.length}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-800">
                <span className="text-sm text-slate-400">Gateway</span>
                <span className="text-slate-100 font-mono text-sm">{status?.gateway || '192.168.1.1'}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-400">WAN IP</span>
                <span className="text-slate-100 font-mono text-sm">{status?.wanIp || '203.0.113.1'}</span>
              </div>
            </CardContent>
          </Card>

          <BandwidthChart data={bandwidthHistory.slice(-12)} title="Live Bandwidth" />
        </div>
      </div>
    </div>
  );
}

export default function NetworkPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      <div className="lg:ml-64">
        <TopNavbar />
        <main>
          <NetworkContent />
        </main>
      </div>
    </div>
  );
}
