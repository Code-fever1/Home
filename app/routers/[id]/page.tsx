'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sidebar } from '@/components/custom/Sidebar';
import { TopNavbar } from '@/components/custom/TopNavbar';
import { StatusBadge } from '@/components/custom/StatusBadge';
import { BandwidthChart } from '@/components/custom/BandwidthChart';
import { useRouterStore } from '@/store/routerStore';
import { ArrowLeft, Power, RefreshCw, Wifi, Users, Settings, Clock, AlertCircle } from 'lucide-react';
import Link from 'next/link';

function formatUptime(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  return `${days}d ${hours}h ${mins}m`;
}

function RouterDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const routerId = params.id as string;
  const { selectedRouter, routerStats, routerLogs, loading, fetchRouter, fetchRouterStats, fetchRouterLogs, rebootRouter } = useRouterStore();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (routerId) {
      fetchRouter(routerId);
      fetchRouterStats(routerId);
      fetchRouterLogs(routerId, 50);
    }
  }, [routerId, fetchRouter, fetchRouterStats, fetchRouterLogs]);

  const handleReboot = async () => {
    if (selectedRouter && confirm(`Are you sure you want to reboot ${selectedRouter.name}?`)) {
      await rebootRouter(selectedRouter.id);
    }
  };

  if (loading || !selectedRouter) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-slate-800 rounded" />
          <div className="h-64 bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/routers">
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-100">{selectedRouter.name}</h1>
          <p className="text-slate-400">{selectedRouter.model} • {selectedRouter.ipAddress}</p>
        </div>
        <StatusBadge status={selectedRouter.status} />
        <Button
          variant="outline"
          className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 border-amber-500/30"
          onClick={handleReboot}
        >
          <Power className="w-4 h-4 mr-2" />
          Reboot
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="overview" className="data-[state=active]:bg-slate-800">Overview</TabsTrigger>
          <TabsTrigger value="clients" className="data-[state=active]:bg-slate-800">Clients</TabsTrigger>
          <TabsTrigger value="wifi" className="data-[state=active]:bg-slate-800">WiFi Settings</TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-slate-800">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Uptime</p>
                    <p className="text-lg font-semibold text-slate-100">{formatUptime(selectedRouter.uptime)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Users className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Connected Clients</p>
                    <p className="text-lg font-semibold text-slate-100">{selectedRouter.connectedClients}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Firmware</p>
                    <p className="text-lg font-semibold text-slate-100">{selectedRouter.firmwareVersion}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Last Seen</p>
                    <p className="text-lg font-semibold text-slate-100">
                      {new Date(selectedRouter.lastSeen).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <BandwidthChart data={routerStats.map(s => ({ timestamp: s.timestamp, download: s.bandwidthIn, upload: s.bandwidthOut }))} title="Router Bandwidth" />

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-base text-slate-100">System Resources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">CPU Usage</span>
                    <span className={selectedRouter.cpuUsage > 80 ? 'text-red-400' : 'text-slate-300'}>
                      {selectedRouter.cpuUsage}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        selectedRouter.cpuUsage > 80 ? 'bg-red-500' : selectedRouter.cpuUsage > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${selectedRouter.cpuUsage}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Memory Usage</span>
                    <span className={selectedRouter.memoryUsage > 80 ? 'text-red-400' : 'text-slate-300'}>
                      {selectedRouter.memoryUsage}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        selectedRouter.memoryUsage > 80 ? 'bg-red-500' : selectedRouter.memoryUsage > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${selectedRouter.memoryUsage}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="clients">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base text-slate-100">Connected Clients ({selectedRouter.connectedClients})</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-center py-8">Client list would be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wifi">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base text-slate-100">WiFi Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg bg-slate-800/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Wifi className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-slate-100">2.4GHz Network</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">SSID</span>
                      <span className="text-slate-300">{selectedRouter.ssid || 'HomeNetwork_2.4G'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Security</span>
                      <span className="text-slate-300">WPA3</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Channel</span>
                      <span className="text-slate-300">6</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-800/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Wifi className="w-4 h-4 text-emerald-500" />
                    <span className="font-medium text-slate-100">5GHz Network</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">SSID</span>
                      <span className="text-slate-300">{selectedRouter.ssid5g || 'HomeNetwork_5G'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Security</span>
                      <span className="text-slate-300">WPA3</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Channel</span>
                      <span className="text-slate-300">36</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base text-slate-100">System Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {routerLogs.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No logs available</p>
                ) : (
                  routerLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 text-sm">
                      <span className="text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={
                        log.level === 'error' ? 'text-red-400' : log.level === 'warning' ? 'text-amber-400' : 'text-slate-300'
                      }>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function RouterDetailsPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      <div className="lg:ml-64">
        <TopNavbar />
        <main>
          <RouterDetailsContent />
        </main>
      </div>
    </div>
  );
}
