import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const pageParam = searchParams.get('page') || '1'
  const pageNumber = parseInt(pageParam, 10)

  if (pageNumber !== 1) {
    return NextResponse.json({ error: 'Only Page 1 is supported in Phase 1 pilot' }, { status: 404 })
  }

  let imagePath = path.join(process.cwd(), 'public', 'qiraat', 'pdf-page-006.png')
  if (!fs.existsSync(imagePath)) {
    imagePath = path.join(process.cwd(), 'docs', 'qiraat', 'source-pages', 'pdf-page-006.png')
  }
  if (!fs.existsSync(imagePath)) {
    return NextResponse.json({ error: 'Source image file not found' }, { status: 404 })
  }

  const imageBuffer = fs.readFileSync(imagePath)
  return new NextResponse(imageBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  })
}
