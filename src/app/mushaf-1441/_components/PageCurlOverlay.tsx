'use client'

// iBooks-style page curl, driven directly on the page elements already on screen.
// The turning sheet folds along a straight line that moves with the peeled corner: the part
// past the fold is clipped off the outgoing page (revealing the new page underneath), and the
// folded flap — the back of the sheet — is the real page element that lands on the other side,
// transformed by the reflection across that line. No page content is copied or re-rendered;
// each animation frame only writes clip-path / transform and a few SVG attributes.

import { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef } from 'react'

export type PageCurlRect = { x: number; y: number; width: number; height: number }

export type PageCurlHandle = {
  /** Follow a drag: `offsetX` is the distance travelled in the turn direction, `offsetY` the vertical move (px). */
  drag: (offsetX: number, offsetY: number) => void
  /** Finish a drag: complete the turn or fall back flat. */
  release: (commit: boolean) => void
}

type Props = {
  /** Rect of the turning sheet, relative to the overlay container. */
  leaf: PageCurlRect
  /** Edge the corner peels from: 'left' turns toward the right, 'right' toward the left. */
  peelFrom: 'left' | 'right'
  /** Horizontal distance the peeled corner travels to lie flat on the other side. */
  travel: number
  mode: 'auto' | 'drag'
  /** Outgoing page element (the front of the turning sheet). */
  front: HTMLElement
  /** The other outgoing page of a spread, kept on top until the flap covers it. */
  still: HTMLElement | null
  /** Incoming page printed on the back of the sheet (spread); null draws blank paper. */
  resolveBack: () => HTMLElement | null
  /** That incoming page's rect, measured before the turn (so no layout is forced here). */
  backRect: PageCurlRect | null
  onFinish: (committed: boolean) => void
}

type Point = { x: number; y: number }

const AUTO_DURATION_MS = 720
const EMPTY_POLYGON = 'polygon(0 0, 0 0, 0 0)'

const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y

// Sutherland–Hodgman: keep the part of a convex polygon where side(point) >= 0.
function clipPolygon(points: Point[], side: (p: Point) => number): Point[] {
  const out: Point[] = []
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    const sc = side(current)
    const sn = side(next)
    if (sc >= 0) out.push(current)
    if ((sc >= 0) !== (sn >= 0)) {
      const k = sc / (sc - sn)
      out.push({ x: current.x + (next.x - current.x) * k, y: current.y + (next.y - current.y) * k })
    }
  }
  return out
}

const toClipPath = (points: Point[]) =>
  points.length < 3 ? EMPTY_POLYGON : `polygon(${points.map((p) => `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`).join(', ')})`

const toSvgPoints = (points: Point[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2)
const easeOut = (t: number) => 1 - (1 - t) ** 3

function setGradient(el: SVGLinearGradientElement | null, from: Point, to: Point) {
  if (!el) return
  el.setAttribute('x1', from.x.toFixed(2))
  el.setAttribute('y1', from.y.toFixed(2))
  el.setAttribute('x2', to.x.toFixed(2))
  el.setAttribute('y2', to.y.toFixed(2))
}

function restoreStyles(el: HTMLElement | null, props: string[]) {
  if (!el) return
  for (const prop of props) el.style.removeProperty(prop)
}

const PageCurlOverlay = forwardRef<PageCurlHandle, Props>(function PageCurlOverlay(
  { leaf, peelFrom, travel, mode, front, still, resolveBack, backRect, onFinish },
  ref,
) {
  const revealRef = useRef<SVGSVGElement>(null)
  const revealPolygonRef = useRef<SVGPolygonElement>(null)
  const revealGradientRef = useRef<SVGLinearGradientElement>(null)
  const frontShadeRef = useRef<SVGSVGElement>(null)
  const frontGradientRef = useRef<SVGLinearGradientElement>(null)
  const flapShadowRef = useRef<SVGSVGElement>(null)
  const flapShadowGroupRef = useRef<SVGGElement>(null)
  const flapShadowPolygonRef = useRef<SVGPolygonElement>(null)
  const flapShadeRef = useRef<SVGSVGElement>(null)
  const flapShadeGroupRef = useRef<SVGGElement>(null)
  const flapPaperRef = useRef<SVGPolygonElement>(null)
  const flapShadePolygonRef = useRef<SVGPolygonElement>(null)
  const flapGradientRef = useRef<SVGLinearGradientElement>(null)
  const backRef = useRef<{ el: HTMLElement | null; dx: number; dy: number }>({ el: null, dx: 0, dy: 0 })
  const stateRef = useRef({ t: 0, lift: 0, frame: 0, finished: false })
  const onFinishRef = useRef(onFinish)
  useEffect(() => {
    onFinishRef.current = onFinish
  })

  const W = leaf.width
  const H = leaf.height
  const gradientId = `curl${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  // Draw the sheet with the peeled corner at progress t (0 flat → 1 turned) lifted by `lift` px.
  function apply(t: number, lift: number) {
    stateRef.current.t = t
    stateRef.current.lift = lift
    const direction = peelFrom === 'left' ? 1 : -1
    const corner: Point = { x: peelFrom === 'left' ? 0 : W, y: H }
    const hingeX = W - corner.x
    const reach = travel - W
    let peeled: Point = { x: corner.x + direction * t * travel, y: Math.min(H, H - lift) }

    // Paper doesn't stretch: keep the corner within reach of the hinge's bottom and top corners.
    const clampTo = (center: Point, radius: number) => {
      const dx = peeled.x - center.x
      const dy = peeled.y - center.y
      const distance = Math.hypot(dx, dy)
      if (distance > radius) peeled = { x: center.x + (dx * radius) / distance, y: center.y + (dy * radius) / distance }
    }
    clampTo({ x: hingeX, y: H }, reach)
    clampTo({ x: hingeX, y: 0 }, Math.hypot(reach, H))

    const layers = [revealRef.current, frontShadeRef.current, flapShadowRef.current, flapShadeRef.current]
    const back = backRef.current
    const span = Math.hypot(peeled.x - corner.x, peeled.y - corner.y)
    if (span < 0.5) {
      front.style.clipPath = 'none'
      for (const layer of layers) if (layer) layer.style.visibility = 'hidden'
      if (back.el) back.el.style.clipPath = EMPTY_POLYGON
      return
    }
    for (const layer of layers) if (layer) layer.style.visibility = 'visible'

    // Fold line: perpendicular bisector of corner → peeled corner; n points toward the peeled corner.
    const mid: Point = { x: (corner.x + peeled.x) / 2, y: (corner.y + peeled.y) / 2 }
    const n: Point = { x: (peeled.x - corner.x) / span, y: (peeled.y - corner.y) / span }
    const side = (p: Point) => dot({ x: p.x - mid.x, y: p.y - mid.y }, n)
    const sheet: Point[] = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]
    const flat = clipPolygon(sheet, side)
    const folded = clipPolygon(sheet, (p) => -side(p))
    const depth = Math.max(1, ...folded.map((p) => -side(p)))

    // Flat part of the outgoing page, darkening slightly toward the bend.
    const flatClip = toClipPath(flat)
    front.style.clipPath = flatClip
    if (frontShadeRef.current) frontShadeRef.current.style.clipPath = flatClip
    setGradient(frontGradientRef.current, mid, { x: mid.x + n.x * W * 0.14, y: mid.y + n.y * W * 0.14 })

    // Shadow the lifted flap casts on the page revealed underneath.
    revealPolygonRef.current?.setAttribute('points', toSvgPoints(folded))
    const shadowLength = Math.min(W * 0.45, depth * 1.2 + 24)
    setGradient(revealGradientRef.current, mid, { x: mid.x - n.x * shadowLength, y: mid.y - n.y * shadowLength })

    // Back of the sheet: mirror onto the sheet (x → W − x), then reflect across the fold.
    // Two reflections make a rotation, so the incoming page's text reads the right way round.
    const d = dot(n, mid)
    const a = -(1 - 2 * n.x * n.x)
    const b = 2 * n.x * n.y
    const c = -2 * n.x * n.y
    const e = 1 - 2 * n.y * n.y
    const tx = W * (1 - 2 * n.x * n.x) + 2 * d * n.x
    const ty = -2 * n.x * n.y * W + 2 * d * n.y
    const matrix = `matrix(${a} ${b} ${c} ${e} ${tx} ${ty})`
    const flapLocal = folded.map((p) => ({ x: W - p.x, y: p.y }))
    const flapPoints = toSvgPoints(flapLocal)
    flapShadowGroupRef.current?.setAttribute('transform', matrix)
    flapShadowPolygonRef.current?.setAttribute('points', flapPoints)
    flapShadeGroupRef.current?.setAttribute('transform', matrix)
    flapPaperRef.current?.setAttribute('points', flapPoints)
    flapShadePolygonRef.current?.setAttribute('points', flapPoints)
    const flapMid: Point = { x: W - mid.x, y: mid.y }
    setGradient(flapGradientRef.current, flapMid, { x: flapMid.x + n.x * depth, y: flapMid.y - n.y * depth })

    if (back.el) {
      // The incoming page sits at its own position; shift the transform so it lands on the sheet.
      back.el.style.transform = `matrix(${a}, ${b}, ${c}, ${e}, ${tx + back.dx}, ${ty + back.dy})`
      back.el.style.clipPath = toClipPath(flapLocal)
    }
  }

  function animateTo(target: number, committed: boolean, easing: (t: number) => number, duration: number) {
    cancelAnimationFrame(stateRef.current.frame)
    const startT = stateRef.current.t
    const startLift = stateRef.current.lift
    const startTime = performance.now()
    const total = Math.max(160, duration * Math.abs(target - startT))
    const step = (now: number) => {
      const k = Math.min(1, (now - startTime) / total)
      const t = startT + (target - startT) * easing(k)
      // Keep the corner lifted mid-turn, settling flat at either end.
      const arc = H * 0.16 * Math.sin(Math.PI * t)
      apply(t, startLift * (1 - k) + arc * k)
      if (k < 1) {
        stateRef.current.frame = requestAnimationFrame(step)
      } else if (!stateRef.current.finished) {
        stateRef.current.finished = true
        onFinishRef.current(committed)
      }
    }
    stateRef.current.frame = requestAnimationFrame(step)
  }

  useImperativeHandle(ref, () => ({
    drag(offsetX, offsetY) {
      if (stateRef.current.finished) return
      cancelAnimationFrame(stateRef.current.frame)
      const t = Math.max(0, Math.min(1, offsetX / W))
      apply(t, Math.max(0, -offsetY) * 0.9 + H * 0.1 * Math.sin(Math.PI * t))
    },
    release(commit) {
      if (stateRef.current.finished) return
      animateTo(commit ? 1 : 0, commit, easeOut, AUTO_DURATION_MS * 0.8)
    },
  }))

  // Lift the outgoing pages above the (already visible) incoming spread before the first paint.
  useLayoutEffect(() => {
    const backEl = backRect ? resolveBack() : null
    if (backEl && backRect) {
      backRef.current = { el: backEl, dx: leaf.x - backRect.x, dy: leaf.y - backRect.y }
      backEl.style.transformOrigin = '0 0'
      backEl.style.zIndex = '30'
      backEl.style.willChange = 'transform, clip-path'
    }
    front.style.visibility = 'visible'
    front.style.zIndex = '25'
    front.style.willChange = 'clip-path'
    if (still) {
      still.style.visibility = 'visible'
      still.style.zIndex = '21'
    }
    const state = stateRef.current
    apply(state.t, state.lift)
    return () => {
      cancelAnimationFrame(state.frame)
      restoreStyles(front, ['visibility', 'z-index', 'clip-path', 'will-change'])
      restoreStyles(still, ['visibility', 'z-index'])
      restoreStyles(backRef.current.el, ['transform', 'transform-origin', 'clip-path', 'z-index', 'will-change'])
    }
    // Elements and geometry are fixed for the lifetime of one turn (the overlay is keyed per turn).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mode !== 'auto' || stateRef.current.finished) return
    animateTo(1, true, stateRef.current.t > 0 ? easeOut : easeInOut, AUTO_DURATION_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const place = { left: leaf.x, top: leaf.y, width: W, height: H, visibility: 'hidden' as const }

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg ref={revealRef} className="absolute overflow-visible" style={{ ...place, zIndex: 20 }}>
        <defs>
          <linearGradient id={`${gradientId}-reveal`} ref={revealGradientRef} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgb(40,30,12)" stopOpacity="0.42" />
            <stop offset="0.35" stopColor="rgb(40,30,12)" stopOpacity="0.16" />
            <stop offset="1" stopColor="rgb(40,30,12)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon ref={revealPolygonRef} fill={`url(#${gradientId}-reveal)`} />
      </svg>

      <svg ref={frontShadeRef} className="absolute" style={{ ...place, zIndex: 26 }}>
        <defs>
          <linearGradient id={`${gradientId}-front`} ref={frontGradientRef} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgb(40,30,12)" stopOpacity="0.22" />
            <stop offset="1" stopColor="rgb(40,30,12)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${gradientId}-front)`} />
      </svg>

      <svg ref={flapShadowRef} className="absolute overflow-visible" style={{ ...place, zIndex: 29 }}>
        <defs>
          <filter id={`${gradientId}-blur`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>
        <g ref={flapShadowGroupRef}>
          <polygon ref={flapShadowPolygonRef} fill="rgb(40,30,12)" fillOpacity="0.3" filter={`url(#${gradientId}-blur)`} />
        </g>
      </svg>

      <svg ref={flapShadeRef} className="absolute overflow-visible" style={{ ...place, zIndex: 31 }}>
        <defs>
          <linearGradient id={`${gradientId}-flap`} ref={flapGradientRef} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgb(40,30,12)" stopOpacity="0.26" />
            <stop offset="0.06" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="0.3" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="1" stopColor="rgb(40,30,12)" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <g ref={flapShadeGroupRef}>
          {/* A single page has nothing printed on its back: blank paper. */}
          <polygon ref={flapPaperRef} fill="#fffdf6" style={{ display: still === null ? undefined : 'none' }} />
          <polygon ref={flapShadePolygonRef} fill={`url(#${gradientId}-flap)`} />
        </g>
      </svg>
    </div>
  )
})

export default PageCurlOverlay
