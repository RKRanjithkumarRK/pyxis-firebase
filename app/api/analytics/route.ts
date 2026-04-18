import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'

export const dynamic = 'force-dynamic'

const BACKEND = process.env.BACKEND_URL || 'https://ranjith00743-pyxis-one-backend.hf.space'

export async function GET(req: NextRequest) {
  const user = await verifyToken(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const token = req.headers.get('authorization') || ''
    const { searchParams } = new URL(req.url)
    const endpoint = searchParams.get('endpoint') || 'dashboard'

    const res = await fetch(`${BACKEND}/api/analytics/${endpoint}`, {
      headers: { Authorization: token },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Backend error' }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Analytics API error:', err)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
