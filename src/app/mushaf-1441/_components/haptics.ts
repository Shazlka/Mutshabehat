'use client'

// One crisp "impact" tick — the feel of holding an iOS home-screen icon until its menu appears.
//
// No single API covers both platforms, so this tries two paths and stays silent if neither exists:
//
//  1. `navigator.vibrate` — Android / Chromium. A single short pulse: anything much longer than
//     ~20 ms stops reading as a tap and starts reading as a buzz.
//  2. iOS 17.4+ only — WebKit plays the system switch haptic when a <label> bound to an
//     <input type="checkbox" switch> is clicked. Mobile Safari exposes no Vibration API at all
//     (`navigator.vibrate` is simply absent), so this is the only haptic an iOS web page can ask
//     for. It is a platform quirk, not a standard: if a future WebKit stops playing it the tick
//     just goes quiet, and nothing else depends on it.
//
// Both paths are best-effort and fully wrapped — a blocked permissions policy makes `vibrate`
// throw, and a page that has not been interacted with yet can refuse the synthetic click.

let hapticLabel: HTMLLabelElement | null = null

function iosHapticLabel(): HTMLLabelElement | null {
  if (typeof document === 'undefined' || !document.body) return null
  if (hapticLabel?.isConnected) return hapticLabel

  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.id = 'mushaf-haptic-switch'
  input.tabIndex = -1
  input.setAttribute('aria-hidden', 'true')

  const label = document.createElement('label')
  label.htmlFor = input.id
  label.setAttribute('aria-hidden', 'true')

  // Kept in the layout rather than `display:none` — WebKit skips the haptic for a control it is
  // not actually rendering — but zero-sized, fully transparent, unhittable and out of the tab order.
  const hidden = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0;margin:0;padding:0;'
  input.style.cssText = hidden
  label.style.cssText = hidden

  document.body.append(input, label)
  hapticLabel = label
  return label
}

export function impactHaptic() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      // A `true` return means the request was accepted; desktops accept it and have no motor,
      // which is correct — they should not fall through to the iOS path either.
      if (navigator.vibrate(15)) return
    }
  } catch {
    // Vibration blocked by a permissions policy.
  }
  try {
    iosHapticLabel()?.click()
  } catch {
    // Best effort only.
  }
}
