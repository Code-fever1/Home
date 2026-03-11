'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sidebar } from '@/components/custom/Sidebar';
import { TopNavbar } from '@/components/custom/TopNavbar';
import { DeviceCard } from '@/components/custom/DeviceCard';
import { useDeviceStore } from '@/store/deviceStore';
import { useRouterStore } from '@/store/routerStore';
import { RefreshCw, Search, Filter, Smartphone, Laptop, Monitor, Tablet, Tv, Camera, Printer, Wifi, HelpCircle } from 'lucide-react';
import { DeviceType } from '@/types/device';

const deviceTypeIcons: Record<DeviceType, typeof Smartphone> = {
  smartphone: Smartphone,
  laptop: Laptop,
  desktop: Monitor,
  tablet: Tablet,
  smart_tv: Tv,
  camera: Camera,
  printer: Printer,
  iot: Wifi,
  other: HelpCircle,
};

const deviceTypeLabels: Record<DeviceType, string> = {
  smartphone: 'Smartphone',
  laptop: 'Laptop',
  desktop: 'Desktop',
  tablet: 'Tablet',
  smart_tv: 'Smart TV',
  camera: 'Camera',
  printer: 'Printer',
  iot: 'IoT Device',
  other: 'Other',
};

function DevicesContent() {
  const { devices, loading, error, fetchDevices } = useDeviceStore();
  const { routers } = useRouterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<DeviceType | 'all'>('all');

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const filteredDevices = devices.filter((device) => {
    const matchesSearch = device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         device.ipAddress.includes(searchQuery) ||
                         device.macAddress.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || device.deviceType === selectedType;
    return matchesSearch && matchesType;
  });

  const onlineDevices = filteredDevices.filter((d) => d.status === 'online');
  const offlineDevices = filteredDevices.filter((d) => d.status === 'offline');
  const blockedDevices = filteredDevices.filter((d) => d.isBlocked);

  const deviceCounts = devices.reduce((acc, device) => {
    acc[device.deviceType] = (acc[device.deviceType] || 0) + 1;
    return acc;
  }, {} as Record<DeviceType, number>);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Devices</h1>
          <p className="text-slate-400 mt-1">Manage connected devices on your network</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
            onClick={fetchDevices}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        <Card
          className={`bg-slate-900/50 border-slate-800 cursor-pointer transition-colors ${selectedType === 'all' ? 'border-blue-500/50 bg-blue-500/5' : ''}`}
          onClick={() => setSelectedType('all')}
        >
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-slate-100">{devices.length}</p>
            <p className="text-sm text-slate-500">All Devices</p>
          </CardContent>
        </Card>

        {(Object.keys(deviceTypeLabels) as DeviceType[]).map((type) => {
          const Icon = deviceTypeIcons[type];
          const count = deviceCounts[type] || 0;
          return (
            <Card
              key={type}
              className={`bg-slate-900/50 border-slate-800 cursor-pointer transition-colors ${selectedType === type ? 'border-blue-500/50 bg-blue-500/5' : ''}`}
              onClick={() => setSelectedType(type)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5 text-slate-400" />
                  <p className="text-2xl font-bold text-slate-100">{count}</p>
                </div>
                <p className="text-sm text-slate-500 mt-1">{deviceTypeLabels[type]}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search devices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-900 border-slate-800 text-slate-100"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-slate-700 text-slate-300">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      <div className="flex gap-2 text-sm">
        <button
          onClick={() => {}}
          className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500"
        >
          Online ({onlineDevices.length})
        </button>
        <button
          onClick={() => {}}
          className="px-3 py-1.5 rounded-full bg-slate-800 text-slate-400"
        >
          Offline ({offlineDevices.length})
        </button>
        <button
          onClick={() => {}}
          className="px-3 py-1.5 rounded-full bg-red-500/10 text-red-500"
        >
          Blocked ({blockedDevices.length})
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-slate-900/50 border-slate-800 h-[300px] animate-pulse" />
          ))
        ) : filteredDevices.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-slate-500">No devices found</p>
          </div>
        ) : (
          filteredDevices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))
        )}
      </div>
    </div>
  );
}

export default function DevicesPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      <div className="lg:ml-64">
        <TopNavbar />
        <main>
          <DevicesContent />
        </main>
      </div>
    </div>
  );
}
