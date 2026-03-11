'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from './StatusBadge';
import { ConnectionIndicator } from './ConnectionIndicator';
import { Router } from '@/types/router';
import { Power, Settings, Users, Wifi } from 'lucide-react';
import { useRouterStore } from '@/store/routerStore';
import Link from 'next/link';

interface RouterCardProps {
  router: Router;
}

export function RouterCard({ router }: RouterCardProps) {
  const { rebootRouter } = useRouterStore();

  const handleReboot = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Are you sure you want to reboot ${router.name}?`)) {
      await rebootRouter(router.id);
    }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-slate-100">
                {router.name}
              </CardTitle>
              <p className="text-sm text-slate-400">{router.model}</p>
            </div>
          </div>
          <StatusBadge status={router.status} size="sm" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">IP Address</span>
            <p className="text-slate-300 font-mono">{router.ipAddress}</p>
          </div>
          <div>
            <span className="text-slate-500">Clients</span>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-300">{router.connectedClients}</span>
            </div>
          </div>
        </div>

        {router.signalStrength !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Signal</span>
            <ConnectionIndicator strength={router.signalStrength} type="wifi" />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">CPU</span>
            <span className={
              router.cpuUsage > 80 ? 'text-red-400' : router.cpuUsage > 60 ? 'text-amber-400' : 'text-emerald-400'
            }>
              {router.cpuUsage}%
            </span>
          </div>
          <Progress value={router.cpuUsage} className="h-1.5" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Memory</span>
            <span className={
              router.memoryUsage > 80 ? 'text-red-400' : router.memoryUsage > 60 ? 'text-amber-400' : 'text-emerald-400'
            }>
              {router.memoryUsage}%
            </span>
          </div>
          <Progress value={router.memoryUsage} className="h-1.5" />
        </div>

        <div className="flex gap-2 pt-2">
          <Link href={`/routers/${router.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Settings className="w-3.5 h-3.5 mr-1.5" />
              Details
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
            onClick={handleReboot}
          >
            <Power className="w-3.5 h-3.5 mr-1.5" />
            Reboot
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
