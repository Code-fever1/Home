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
├── login/          # Login page
├── dashboard/      # Main dashboard
├── routers/        # Router list and details
├── devices/        # Connected devices
├── network/        # Network topology
└── settings/       # User settings

components/
├── custom/         # Custom components
│   ├── StatusBadge.tsx
│   ├── ConnectionIndicator.tsx
│   ├── RouterCard.tsx
│   ├── DeviceCard.tsx
│   ├── BandwidthChart.tsx
│   ├── NetworkMap.tsx
│   ├── Sidebar.tsx
│   └── TopNavbar.tsx
└── ui/             # shadcn/ui components

lib/
├── api.ts          # API client
├── websocket.ts    # WebSocket integration
├── mockData.ts     # Mock data for testing
└── utils.ts        # Utility functions

store/
├── routerStore.ts  # Router state management
├── deviceStore.ts  # Device state management
└── networkStore.ts # Network state management

types/
├── router.ts       # Router type definitions
├── device.ts       # Device type definitions
└── network.ts      # Network type definitions
```

## Pages

- **Dashboard** (`/dashboard`): Overview with stats, charts, and alerts
- **Routers** (`/routers`): List and manage all routers
- **Router Details** (`/routers/[id]`): Detailed router management
- **Devices** (`/devices`): List all connected devices
- **Network** (`/network`): Visual network topology
- **Settings** (`/settings`): User and system configuration

## API Integration

The application includes a mock data mode for development. To switch to real API:

1. Set `USE_MOCK_DATA = false` in `lib/api.ts`
2. Configure `NEXT_PUBLIC_API_URL` in your environment

## WebSocket Events

- `router_status_update` - Router status changes
- `device_connected` - New device connected
- `device_disconnected` - Device disconnected
- `bandwidth_update` - Bandwidth usage updates
- `network_event` - Network events and alerts

## License

MIT
