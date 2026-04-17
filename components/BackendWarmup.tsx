'use client'

import { useEffect } from 'react'

export default function BackendWarmup() {
  useEffect(() => {
    // Silently ping the backend so HuggingFace Spaces wakes before the user's first API call.
    fetch('/health', { method: 'GET', cache: 'no-store' }).catch(() => {})
  }, [])

  return null
}
