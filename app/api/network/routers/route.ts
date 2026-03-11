/**
 * GET /api/network/routers
 * Returns normalised status for all routers (Huawei + Tenda N301 + Tenda F3).
 */

import { NextResponse } from 'next/server';
import { getAllRouters } from '@/lib/network/aggregator';

export const runtime = 'nodejs';
export const revalidate = 30;

export async function GET() {
  const routers = await getAllRouters();
  return NextResponse.json({ routers, fetchedAt: new Date().toISOString() });
}
