'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NetworkTopology, NetworkNode, NetworkLink } from '@/types/network';
import { Router } from '@/types/router';
import { Device } from '@/types/device';
import { Wifi, Globe, Monitor, Server } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface NetworkMapProps {
  routers: Router[];
  devices: Device[];
  topology?: NetworkTopology;
}

const NODE_SIZE = 48;
const LAYER_HEIGHT = 140;
const NODE_SPACING = 180;

export function NetworkMap({ routers, devices, topology }: NetworkMapProps) {
  const { nodes, links } = useMemo(() => {
    if (topology) return topology;

    // Generate topology from routers and devices
    const generatedNodes: NetworkNode[] = [
      { id: 'internet', type: 'internet', label: 'Internet', status: 'online' },
    ];
    const generatedLinks: NetworkLink[] = [];

    // Add router nodes
    routers.forEach((router, index) => {
      generatedNodes.push({
        id: router.id,
        type: 'router',
        label: router.name,
        status: router.status,
        ip: router.ipAddress,
      });
      generatedLinks.push({
        source: 'internet',
        target: router.id,
        type: 'ethernet',
      });
    });

    // Add device nodes
    devices.forEach((device) => {
      if (!generatedNodes.find((n) => n.id === device.id)) {
        generatedNodes.push({
          id: device.id,
          type: 'device',
          label: device.name,
          status: device.status === 'blocked' ? 'offline' : device.status,
          ip: device.ipAddress,
          mac: device.macAddress,
        });
        generatedLinks.push({
          source: device.routerId,
          target: device.id,
          type: device.connectionType,
        });
      }
    });

    return { nodes: generatedNodes, links: generatedLinks };
  }, [routers, devices, topology]);

  // Calculate positions for a tree layout
  const positionedNodes = useMemo(() => {
    const layers: NetworkNode[][] = [[nodes.find((n) => n.type === 'internet')!]];
    const nodePositions = new Map<string, { x: number; y: number }>();

    // Build layers
    let currentLayer = layers[0];
    while (currentLayer.length > 0) {
      const nextLayer: NetworkNode[] = [];
      for (const node of currentLayer) {
        const connected = links
          .filter((l) => l.source === node.id)
          .map((l) => nodes.find((n) => n.id === l.target))
          .filter(Boolean) as NetworkNode[];
        nextLayer.push(...connected);
      }
      if (nextLayer.length > 0) {
        layers.push(nextLayer);
        currentLayer = nextLayer;
      } else {
        break;
      }
    }

    // Position nodes
    const containerWidth = 800;
    layers.forEach((layer, layerIndex) => {
      const y = layerIndex * LAYER_HEIGHT + 60;
      const totalWidth = layer.length * NODE_SPACING;
      const startX = (containerWidth - totalWidth) / 2 + NODE_SPACING / 2;

      layer.forEach((node, nodeIndex) => {
        nodePositions.set(node.id, {
          x: startX + nodeIndex * NODE_SPACING,
          y,
        });
      });
    });

    return nodePositions;
  }, [nodes, links]);

  const renderNodeIcon = (node: NetworkNode) => {
    const baseClasses = 'w-10 h-10 rounded-full flex items-center justify-center';
    const statusClasses =
      node.status === 'online'
        ? 'bg-emerald-500/20 text-emerald-500 border-2 border-emerald-500/50'
        : node.status === 'warning'
        ? 'bg-amber-500/20 text-amber-500 border-2 border-amber-500/50'
        : 'bg-red-500/20 text-red-500 border-2 border-red-500/50';

    switch (node.type) {
      case 'internet':
        return (
          <div className={`${baseClasses} bg-blue-500/20 text-blue-500 border-2 border-blue-500/50`}>
            <Globe className="w-5 h-5" />
          </div>
        );
      case 'router':
        return (
          <div className={`${baseClasses} ${statusClasses}`}>
            <Wifi className="w-5 h-5" />
          </div>
        );
      case 'device':
        return (
          <div className={`${baseClasses} ${statusClasses}`}>
            <Monitor className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className={`${baseClasses} ${statusClasses}`}>
            <Server className="w-5 h-5" />
          </div>
        );
    }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-100">Network Topology</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative w-full overflow-x-auto">
          <svg viewBox="0 0 800 400" className="w-full min-w-[600px]" preserveAspectRatio="xMidYMid meet">
            {/* Links */}
            {links.map((link, index) => {
              const sourcePos = positionedNodes.get(link.source);
              const targetPos = positionedNodes.get(link.target);
              if (!sourcePos || !targetPos) return null;

              return (
                <line
                  key={index}
                  x1={sourcePos.x}
                  y1={sourcePos.y}
                  x2={targetPos.x}
                  y2={targetPos.y}
                  stroke="#334155"
                  strokeWidth="2"
                  strokeDasharray={link.type === 'wifi' ? '4 4' : undefined}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const pos = positionedNodes.get(node.id);
              if (!pos) return null;

              return (
                <g key={node.id} transform={`translate(${pos.x - 20}, ${pos.y - 20})`}>
                  <foreignObject width="40" height="40">
                    <div className="flex items-center justify-center w-full h-full">
                      {renderNodeIcon(node)}
                    </div>
                  </foreignObject>
                  <text
                    x="20"
                    y="55"
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="10"
                    fontWeight="500"
                  >
                    {node.label}
                  </text>
                  {node.ip && (
                    <text
                      x="20"
                      y="68"
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      {node.ip}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-400">Online</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-slate-400">Warning</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-slate-400">Offline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-slate-600" />
            <span className="text-slate-400">Ethernet</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 border-t-2 border-dashed border-slate-600" />
            <span className="text-slate-400">WiFi</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
