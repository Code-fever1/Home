/**
 * GET /api/huawei/devices
 *
 * Returns all devices currently connected to the Huawei HG8245W5 router.
 * Data is fetched live from the router via the authenticated
 * /html/bbsp/common/GetLanUserDevInfo.asp and
 * /html/bbsp/common/GetLanUserDhcpInfo.asp endpoints.
 *
 * Response shape:
 *   {
 *     router:    "Huawei HG8245W5",
 *     routerIP:  "100.10.10.1",
 *     deviceCount: number,
 *     devices:   [{ name, ip, mac, connection, signal?, leaseTime? }],
 *     fetchedAt: ISO string,
 *   }
 */

import { NextResponse } from 'next/server';
import { getHuaweiDevices, RouterError } from '@/lib/routers/huawei';

export const runtime = 'nodejs';
// No static caching — device lists must always be current
export const dynamic = 'force-dynamic';

const ROUTER_IP = process.env.ROUTER_HUAWEI_IP ?? 'http://100.10.10.1';

export async function GET() {
  try {
    const result = await getHuaweiDevices();

    return NextResponse.json({
      router: result.router,
      routerIP: result.routerIP || ROUTER_IP.replace(/^https?:\/\//, ''), // strip protocol for display
      deviceCount: result.deviceCount,
      devices: result.devices.map((d) => ({
        name: d.name,
        ip: d.ip,
        mac: d.mac,
        connection: d.connection,
        ...(d.signal !== undefined && { signal: d.signal }),
        ...(d.leaseTime !== undefined && { leaseTime: d.leaseTime }),
      })),
      fetchedAt: result.fetchedAt,
    });
  } catch (err) {
    const routerErr = err instanceof RouterError ? err : null;
    const kind = routerErr?.kind ?? 'unknown';
    const message = err instanceof Error ? err.message : String(err);

    console.error('[api/huawei/devices] error:', kind, message);

    const status =
      kind === 'offline' ? 503 :
      kind === 'invalid_credentials' ? 401 :
      kind === 'timeout' ? 504 :
      500;

    return NextResponse.json(
      {
        error: kind,
        message,
        router: 'Huawei HG8245W5',
        routerIP: ROUTER_IP.replace(/^https?:\/\//, ''),
        deviceCount: 0,
        devices: [],
      },
      { status }
    );
  }
}
