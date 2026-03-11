'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/custom/Sidebar';
import { TopNavbar } from '@/components/custom/TopNavbar';
import { RouterCard } from '@/components/custom/RouterCard';
import { StatusBadge } from '@/components/custom/StatusBadge';
import { useRouterStore } from '@/store/routerStore';
import { RefreshCw, Plus, Filter } from 'lucide-react';
import Link from 'next/link';

function RoutersContent() {
  const { routers, loading, error, fetchRouters } = useRouterStore();

  useEffect(() => {
    fetchRouters();
  }, [fetchRouters]);

  const onlineRouters = routers.filter((r) => r.status === 'online');
  const offlineRouters = routers.filter((r) => r.status === 'offline');
  const warningRouters = routers.filter((r) => r.status === 'warning');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Routers</h1>
          <p className="text-slate-400 mt-1">Manage and monitor your network routers</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
            onClick={fetchRouters}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Router
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-2xl font-bold text-slate-100">{routers.length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Online</p>
                <p className="text-2xl font-bold text-emerald-500">{onlineRouters.length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Offline</p>
                <p className="text-2xl font-bold text-red-500">{offlineRouters.length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Warning</p>
                <p className="text-2xl font-bold text-amber-500">{warningRouters.length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-slate-900/50 border-slate-800 h-[320px] animate-pulse" />
          ))
        ) : routers.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-slate-500">No routers found</p>
          </div>
        ) : (
          routers.map((router) => (
            <RouterCard key={router.id} router={router} />
          ))
        )}
      </div>
    </div>
  );
}

export default function RoutersPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      <div className="lg:ml-64">
        <TopNavbar />
        <main>
          <RoutersContent />
        </main>
      </div>
    </div>
  );
}
