/**
 * GET /api/network/topology
 *
 * Returns the full unified network topology in one shot:
 *   - all routers
 *   - all client devices (linked to their parent router)
 *   - all cameras
 *   - tree-structured topology for the frontend visualiser
 *   - summary counts
 */

import { NextResponse } from 'next/server';
import { getNetworkTopology } from '@/lib/network/aggregator';

export const runtime = 'nodejs';
export const revalidate = 30;

export async function GET() {
  const topology = await getNetworkTopology();
  return NextResponse.json(topology);
}
