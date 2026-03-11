'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Sidebar } from '@/components/custom/Sidebar';
import { TopNavbar } from '@/components/custom/TopNavbar';
import { User, Bell, Shield, Palette, Globe, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

function SettingsContent() {
  const router = useRouter();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [apiNotifications, setApiNotifications] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your account and system preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="profile" className="data-[state=active]:bg-slate-800">Profile</TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-slate-800">Notifications</TabsTrigger>
          <TabsTrigger value="api" className="data-[state=active]:bg-slate-800">API</TabsTrigger>
          <TabsTrigger value="appearance" className="data-[state=active]:bg-slate-800">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base text-slate-100 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">Full Name</Label>
                  <Input
                    id="name"
                    defaultValue="Admin User"
                    className="bg-slate-800 border-slate-700 text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue="admin@alijah.dev"
                    className="bg-slate-800 border-slate-700 text-slate-100"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-slate-300">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  placeholder="••••••••"
                  className="bg-slate-800 border-slate-700 text-slate-100"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-slate-300">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    className="bg-slate-800 border-slate-700 text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-slate-300">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    className="bg-slate-800 border-slate-700 text-slate-100"
                  />
                </div>
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700">Save Changes</Button>
            </CardContent>
          </Card>

          <Card className="bg-red-500/5 border-red-500/20">
            <CardHeader>
              <CardTitle className="text-base text-red-400">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base text-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-800">
                <div>
                  <p className="text-slate-300">Router Status Alerts</p>
                  <p className="text-sm text-slate-500">Get notified when routers go offline</p>
                </div>
                <Switch
                  checked={notifications}
                  onCheckedChange={setNotifications}
                />
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-800">
                <div>
                  <p className="text-slate-300">New Device Connections</p>
                  <p className="text-sm text-slate-500">Notify when new devices connect</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-800">
                <div>
                  <p className="text-slate-300">Security Alerts</p>
                  <p className="text-sm text-slate-500">Important security notifications</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-slate-300">Email Notifications</p>
                  <p className="text-sm text-slate-500">Receive email summaries</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base text-slate-100 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-500" />
                API Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-url" className="text-slate-300">API Base URL</Label>
                <Input
                  id="api-url"
                  defaultValue="http://localhost:3001/api"
                  className="bg-slate-800 border-slate-700 text-slate-100 font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ws-url" className="text-slate-300">WebSocket URL</Label>
                <Input
                  id="ws-url"
                  defaultValue="ws://localhost:3001/ws"
                  className="bg-slate-800 border-slate-700 text-slate-100 font-mono"
                />
              </div>
              <div className="flex items-center justify-between py-3 border-t border-slate-800 pt-4">
                <div>
                  <p className="text-slate-300">API Notifications</p>
                  <p className="text-sm text-slate-500">Show toast notifications for API events</p>
                </div>
                <Switch
                  checked={apiNotifications}
                  onCheckedChange={setApiNotifications}
                />
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700">Save API Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base text-slate-100 flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-500" />
                Appearance Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-800">
                <div>
                  <p className="text-slate-300">Dark Mode</p>
                  <p className="text-sm text-slate-500">Use dark theme throughout the app</p>
                </div>
                <Switch
                  checked={darkMode}
                  onCheckedChange={setDarkMode}
                />
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-800">
                <div>
                  <p className="text-slate-300">Compact View</p>
                  <p className="text-sm text-slate-500">Reduce spacing between elements</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-slate-300">Animations</p>
                  <p className="text-sm text-slate-500">Enable UI animations</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      <div className="lg:ml-64">
        <TopNavbar />
        <main>
          <SettingsContent />
        </main>
      </div>
    </div>
  );
}
