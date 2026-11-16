'use client'

import { useCallback, useEffect, useReducer } from 'react'

export const PHONE_AUTO_HIDE_STORAGE_KEY = 'mushaf1441:phone:autoHideFooter:v1'

export interface PhoneChromeState {
  visible: boolean
  activity: number
}

export type PhoneChromeAction =
  | { type: 'toggle' }
  | { type: 'interact' }
  | { type: 'hide' }
  | { type: 'show' }

export function reducePhoneChrome(state: PhoneChromeState, action: PhoneChromeAction): PhoneChromeState {
  switch (action.type) {
    case 'toggle': return { visible: !state.visible, activity: state.activity + 1 }
    case 'interact': return { visible: true, activity: state.activity + 1 }
    case 'hide': return { ...state, visible: false }
    case 'show': return state.visible ? state : { ...state, visible: true }
  }
}

export function phoneChromeHideDelay(options: {
  autoHidesFooter: boolean
  autoHideAfterMs: number | null
  visible: boolean
  forceVisible: boolean
}): number | null {
  if (!options.autoHidesFooter || options.autoHideAfterMs === null || !options.visible || options.forceVisible) return null
  return options.autoHideAfterMs
}

function readAutoHide(defaultValue: boolean) {
  if (typeof window === 'undefined') return defaultValue
  try {
    const stored = window.localStorage.getItem(PHONE_AUTO_HIDE_STORAGE_KEY)
    return stored === null ? defaultValue : stored === 'true'
  } catch {
    return defaultValue
  }
}

export function usePhoneChrome(options: {
  autoHideAfterMs: number | null
  forceVisible?: boolean
  autoHidesFooter?: boolean
}) {
  const [state, dispatch] = useReducer(reducePhoneChrome, { visible: true, activity: 0 })
  const autoHidesFooter = options.autoHidesFooter ?? readAutoHide(false)

  useEffect(() => {
    if (options.autoHidesFooter === undefined) return
    try { window.localStorage.setItem(PHONE_AUTO_HIDE_STORAGE_KEY, String(options.autoHidesFooter)) } catch { /* Applies for this visit. */ }
  }, [options.autoHidesFooter])

  useEffect(() => {
    if (options.forceVisible) dispatch({ type: 'show' })
  }, [options.forceVisible])

  useEffect(() => {
    const delay = phoneChromeHideDelay({ autoHidesFooter, autoHideAfterMs: options.autoHideAfterMs, visible: state.visible, forceVisible: options.forceVisible === true })
    if (delay === null) return
    const timer = window.setTimeout(() => dispatch({ type: 'hide' }), delay)
    return () => window.clearTimeout(timer)
  }, [autoHidesFooter, options.autoHideAfterMs, options.forceVisible, state.activity, state.visible])

  const toggle = useCallback(() => dispatch({ type: 'toggle' }), [])
  const reset = useCallback(() => dispatch({ type: 'interact' }), [])
  return { visible: options.forceVisible ? true : state.visible, toggle, reset, autoHidesFooter }
}
