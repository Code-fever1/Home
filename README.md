# myrouter.alijah.dev

A modern cloud dashboard for remotely monitoring and controlling network routers and devices.

## Features

- **Router Management**: Monitor Huawei HG8245W5, D-Link DWR-X1852E, Tenda N301, Tenda F3, and other routers
- **Device Tracking**: View all connected devices with real-time status
- **Network Topology**: Visual network map showing connections between routers and devices
- **Bandwidth Monitoring**: Real-time charts for network usage
- **WebSocket Integration**: Live updates for router status and device connections
- **Responsive Design**: Works on desktop, tablet, and mobile

## Tech Stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- TailwindCSS
- shadcn/ui components
- Zustand (State Management)
- Axios (API Client)
- Recharts (Charts)
- Lucide React (Icons)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm

### Installation

1. Navigate to the project directory:
```bash
cd Home
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Demo Login

- **Email**: `admin@alijah.dev`
- **Password**: `admin`

## Project Structure

```
app/
â”œâ”€â”€ login/          # Login page
â”œâ”€â”€ dashboard/      # Main dashboard
â”œâ”€â”€ routers/        # Router list and details
â”œâ”€â”€ devices/        # Connected devices
â”œâ”€â”€ network/        # Network topology
â””â”€â”€ settings/       # User settings

components/
â”œâ”€â”€ custom/         # Custom components
â”‚   â”œâ”€â”€ StatusBadge.tsx
â”‚   â”œâ”€â”€ ConnectionIndicator.tsx
â”‚   â”œâ”€â”€ RouterCard.tsx
â”‚   â”œâ”€â”€ DeviceCard.tsx
â”‚   â”œâ”€â”€ BandwidthChart.tsx
â”‚   â”œâ”€â”€ NetworkMap.tsx
â”‚   â”œâ”€â”€ Sidebar.tsx
â”‚   â””â”€â”€ TopNavbar.tsx
â””â”€â”€ ui/             # shadcn/ui components

lib/
â”œâ”€â”€ api.ts          # API client
â”œâ”€â”€ websocket.ts    # WebSocket integration
â””â”€â”€ utils.ts        # Utility functions

store/
â”œâ”€â”€ routerStore.ts  # Router state management
â”œâ”€â”€ deviceStore.ts  # Device state management
â””â”€â”€ networkStore.ts # Network state management

types/
â”œâ”€â”€ router.ts       # Router type definitions
â”œâ”€â”€ device.ts       # Device type definitions
â””â”€â”€ network.ts      # Network type definitions
```

## Pages

- **Dashboard** (`/dashboard`): Overview with stats, charts, and alerts
- **Routers** (`/routers`): List and manage all routers
- **Router Details** (`/routers/[id]`): Detailed router management
- **Devices** (`/devices`): List all connected devices
- **Network** (`/network`): Visual network topology
- **Settings** (`/settings`): User and system configuration

## API Integration

Configure `NEXT_PUBLIC_API_URL` in your environment if your backend is not served from the same Next.js app.

## WebSocket Events

- `router_status_update` - Router status changes
- `device_connected` - New device connected
- `device_disconnected` - Device disconnected
- `bandwidth_update` - Bandwidth usage updates
- `network_event` - Network events and alerts

## License

MIT

