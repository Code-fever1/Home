/**
 * GET /api/network/devices
 *
 * Returns all connected devices from all routers (Huawei + Tenda N301 + F3),
 * aggregated and normalised. Falls back to mock data per-device on failure.
 */

import { NextResponse } from 'next/server';
import { getAllDevices } from '@/lib/network/aggregator';

export const runtime = 'nodejs';
export const revalidate = 30;

export async function GET() {
  const devices = await getAllDevices();
  return NextResponse.json({
    deviceCount: devices.length,
    devices,
    fetchedAt: new Date().toISOString(),
  });
}
