'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { ConnectionIndicator } from './ConnectionIndicator';
import { Device, DeviceType } from '@/types/device';
import { useDeviceStore } from '@/store/deviceStore';
import { 
  Smartphone, 
  Laptop, 
  Monitor, 
  Tablet, 
  Tv, 
  Camera, 
  Printer, 
  HelpCircle,
  Wifi,
  EthernetPort,
  Ban,
  Pencil
} from 'lucide-react';
import { useState } from 'react';

interface DeviceCardProps {
  device: Device;
}

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
  other: 'Unknown',
};

export function DeviceCard({ device }: DeviceCardProps) {
  const { blockDevice, unblockDevice, renameDevice } = useDeviceStore();
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(device.name);

  const DeviceIcon = deviceTypeIcons[device.deviceType];
  const ConnectionTypeIcon = device.connectionType === 'wifi' ? Wifi : EthernetPort;

  const handleBlock = async () => {
    if (device.isBlocked) {
      await unblockDevice(device.id);
    } else {
      await blockDevice(device.id);
    }
  };

  const handleRename = async () => {
    if (newName !== device.name) {
      await renameDevice(device.id, newName);
    }
    setIsEditing(false);
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
              <DeviceIcon className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="px-2 py-1 text-sm bg-slate-800 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename();
                      if (e.key === 'Escape') {
                        setNewName(device.name);
                        setIsEditing(false);
                      }
                    }}
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" onClick={handleRename}>Save</Button>
                </div>
              ) : (
                <CardTitle className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  {device.name}
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-slate-500 hover:text-slate-300"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </CardTitle>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">{deviceTypeLabels[device.deviceType]}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-500 font-mono">{device.ipAddress}</span>
              </div>
            </div>
          </div>
          <StatusBadge status={device.isBlocked ? 'blocked' : device.status} size="sm" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">MAC Address</span>
            <p className="text-slate-300 font-mono">{device.macAddress}</p>
          </div>
          <div>
            <span className="text-slate-500">Router</span>
            <p className="text-slate-300">{device.routerName || 'Unknown'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ConnectionTypeIcon className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400 capitalize">{device.connectionType}</span>
          </div>
          {device.signalStrength !== undefined && (
            <ConnectionIndicator strength={device.signalStrength} type="wifi" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 py-2 border-t border-slate-800">
          <div>
            <span className="text-xs text-slate-500">Download</span>
            <p className="text-sm font-medium text-slate-300">
              {(device.bandwidthIn / 1024 / 1024).toFixed(1)} MB/s
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Upload</span>
            <p className="text-sm font-medium text-slate-300">
              {(device.bandwidthOut / 1024 / 1024).toFixed(1)} MB/s
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className={`w-full ${
            device.isBlocked
              ? 'text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10'
              : 'text-red-500 hover:text-red-400 hover:bg-red-500/10'
          }`}
          onClick={handleBlock}
        >
          <Ban className="w-3.5 h-3.5 mr-1.5" />
          {device.isBlocked ? 'Unblock Device' : 'Block Device'}
        </Button>
      </CardContent>
    </Card>
  );
}
