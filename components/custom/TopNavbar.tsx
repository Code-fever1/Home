'use client';

import { Bell, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileSidebar } from './Sidebar';
import { StatusBadge } from './StatusBadge';

export function TopNavbar() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-8">
        <MobileSidebar />
        
        <div className="flex items-center gap-2 lg:hidden">
          <span className="text-lg font-semibold text-slate-100">RouterOS</span>
        </div>

        <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute ml-3 pointer-events-none" />
          <Input
            type="search"
            placeholder="Search routers, devices..."
            className="pl-9 bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <div className="hidden sm:flex items-center gap-2 mr-4">
            <StatusBadge status="online" size="sm" />
            <span className="text-sm text-slate-400">System Online</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="relative text-slate-400 hover:text-slate-100"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-slate-100"
          >
            <User className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
