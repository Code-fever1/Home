/**
 * GET /api/network/cameras
 * Returns status for all cameras.
 */

import { NextResponse } from 'next/server';
import { getAllCameras } from '@/lib/network/aggregator';

export const runtime = 'nodejs';
export const revalidate = 30;

export async function GET() {
  const cameras = await getAllCameras();
  return NextResponse.json({ cameras, fetchedAt: new Date().toISOString() });
}
