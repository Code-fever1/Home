'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BandwidthData } from '@/types/network';

interface BandwidthChartProps {
  data: BandwidthData[];
  title?: string;
}

const formatSpeed = (bytes: number): string => {
  const mbps = bytes / 1024 / 1024;
  return mbps.toFixed(1) + ' MB/s';
};

export function BandwidthChart({ data, title = 'Bandwidth Usage' }: BandwidthChartProps) {
  const chartData = useMemo(() => {
    return data.map((item) => ({
      time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      download: item.download / 1024 / 1024,
      upload: item.upload / 1024 / 1024,
    }));
  }, [data]);

  const maxValue = useMemo(() => {
    if (chartData.length === 0) return 10;
    const max = Math.max(
      ...chartData.map((d) => Math.max(d.download, d.upload))
    );
    return Math.ceil(max * 1.1) || 10;
  }, [chartData]);

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-100">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                minTickGap={30}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={[0, maxValue]}
                tickFormatter={(value) => `${value.toFixed(0)} MB/s`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '8px',
                }}
                labelStyle={{ color: '#94a3b8', fontSize: '12px' }}
                itemStyle={{ fontSize: '12px' }}
                formatter={(value) => [typeof value === 'number' ? `${value.toFixed(1)} MB/s` : '0 MB/s']}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                iconType="circle"
              />
              <Area
                type="monotone"
                dataKey="download"
                name="Download"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorDownload)"
              />
              <Area
                type="monotone"
                dataKey="upload"
                name="Upload"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorUpload)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
