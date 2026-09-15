import { NextResponse } from 'next/server'
import { runDiag } from '@/lib/diag-dns'
export const dynamic = 'force-dynamic'
export const preferredRegion = 'dxb1'
export async function GET() { return NextResponse.json(await runDiag()) }
