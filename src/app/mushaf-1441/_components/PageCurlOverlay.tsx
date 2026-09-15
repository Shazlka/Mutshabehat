'use client'

// iBooks-style page curl. The turning sheet folds along a straight line that moves with the
// peeled corner: the part past the fold is clipped away (revealing the page underneath),
// and the folded flap — the back of the sheet — is drawn reflected across that line.
// Everything is updated imperatively per animation frame (clip-path, transform, SVG
// gradients), so React renders the heavy page content only once per turn.

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, type ReactNode } from 'react'

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
  front: ReactNode
  back: ReactNode
  /** The other page of the outgoing spread, which stays until the flap covers it. */
  still?: { rect: PageCurlRect; node: ReactNode } | null
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

const toPolygon = (points: Point[]) =>
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

const PageCurlOverlay = forwardRef<PageCurlHandle, Props>(function PageCurlOverlay(
  { leaf, peelFrom, travel, mode, front, back, still, onFinish },
  ref,
) {
  const frontRef = useRef<HTMLDivElement>(null)
  const frontGradientRef = useRef<SVGLinearGradientElement>(null)
  const revealRef = useRef<SVGSVGElement>(null)
  const revealPolygonRef = useRef<SVGPolygonElement>(null)
  const revealGradientRef = useRef<SVGLinearGradientElement>(null)
  const flapRef = useRef<HTMLDivElement>(null)
  const flapInnerRef = useRef<HTMLDivElement>(null)
  const flapGradientRef = useRef<SVGLinearGradientElement>(null)
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

    const frontEl = frontRef.current
    const revealEl = revealRef.current
    const flapEl = flapRef.current
    const flapInnerEl = flapInnerRef.current
    if (!frontEl || !revealEl || !flapEl || !flapInnerEl) return

    const span = Math.hypot(peeled.x - corner.x, peeled.y - corner.y)
    if (span < 0.5) {
      frontEl.style.clipPath = 'none'
      revealEl.style.visibility = 'hidden'
      flapEl.style.visibility = 'hidden'
      return
    }
    revealEl.style.visibility = 'visible'
    flapEl.style.visibility = 'visible'

    // Fold line: perpendicular bisector of corner → peeled corner; n points toward the peeled corner.
    const mid: Point = { x: (corner.x + peeled.x) / 2, y: (corner.y + peeled.y) / 2 }
    const n: Point = { x: (peeled.x - corner.x) / span, y: (peeled.y - corner.y) / span }
    const side = (p: Point) => dot({ x: p.x - mid.x, y: p.y - mid.y }, n)
    const sheet: Point[] = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]
    const flat = clipPolygon(sheet, side)
    const folded = clipPolygon(sheet, (p) => -side(p))
    const depth = Math.max(1, ...folded.map((p) => -side(p)))

    // Flat part of the sheet, darkening slightly toward the bend.
    frontEl.style.clipPath = toPolygon(flat)
    setGradient(frontGradientRef.current, mid, { x: mid.x + n.x * W * 0.14, y: mid.y + n.y * W * 0.14 })

    // Shadow the lifted flap casts on the page revealed underneath.
    revealPolygonRef.current?.setAttribute('points', toSvgPoints(folded))
    const shadowLength = Math.min(W * 0.45, depth * 1.2 + 24)
    setGradient(revealGradientRef.current, mid, { x: mid.x - n.x * shadowLength, y: mid.y - n.y * shadowLength })

    // Back of the sheet: mirror the back page onto the sheet (x → W − x), then reflect across the fold.
    // Two reflections make a rotation, so the back page's text reads the right way round.
    const d = dot(n, mid)
    const a = -(1 - 2 * n.x * n.x)
    const b = 2 * n.x * n.y
    const c = -2 * n.x * n.y
    const e = 1 - 2 * n.y * n.y
    const tx = W * (1 - 2 * n.x * n.x) + 2 * d * n.x
    const ty = -2 * n.x * n.y * W + 2 * d * n.y
    flapInnerEl.style.transform = `matrix(${a}, ${b}, ${c}, ${e}, ${tx}, ${ty})`
    flapInnerEl.style.clipPath = toPolygon(folded.map((p) => ({ x: W - p.x, y: p.y })))
    const flapMid: Point = { x: W - mid.x, y: mid.y }
    setGradient(flapGradientRef.current, flapMid, { x: flapMid.x + n.x * depth, y: flapMid.y - n.y * depth })
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

  useEffect(() => {
    const state = stateRef.current
    apply(state.t, state.lift)
    if (mode === 'auto') animateTo(1, true, state.t > 0 ? easeOut : easeInOut, AUTO_DURATION_MS)
    return () => cancelAnimationFrame(state.frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const place = (rect: PageCurlRect) => ({ left: rect.x, top: rect.y, width: rect.width, height: rect.height })

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {still ? <div className="absolute" style={place(still.rect)}>{still.node}</div> : null}

      <svg ref={revealRef} className="absolute overflow-visible" style={{ ...place(leaf), visibility: 'hidden' }}>
        <defs>
          <linearGradient id={`${gradientId}-reveal`} ref={revealGradientRef} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgb(40,30,12)" stopOpacity="0.42" />
            <stop offset="0.35" stopColor="rgb(40,30,12)" stopOpacity="0.16" />
            <stop offset="1" stopColor="rgb(40,30,12)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon ref={revealPolygonRef} fill={`url(#${gradientId}-reveal)`} />
      </svg>

      <div ref={frontRef} className="absolute" style={place(leaf)}>
        {front}
        <svg className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id={`${gradientId}-front`} ref={frontGradientRef} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="rgb(40,30,12)" stopOpacity="0.22" />
              <stop offset="1" stopColor="rgb(40,30,12)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${gradientId}-front)`} />
        </svg>
      </div>

      <div
        ref={flapRef}
        className="absolute"
        style={{ ...place(leaf), visibility: 'hidden', filter: 'drop-shadow(0 0 14px rgba(40,30,12,0.32))' }}
      >
        <div ref={flapInnerRef} className="absolute left-0 top-0" style={{ width: W, height: H, transformOrigin: '0 0' }}>
          {back}
          <svg className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id={`${gradientId}-flap`} ref={flapGradientRef} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="rgb(40,30,12)" stopOpacity="0.26" />
                <stop offset="0.06" stopColor="#ffffff" stopOpacity="0.4" />
                <stop offset="0.3" stopColor="#ffffff" stopOpacity="0.1" />
                <stop offset="1" stopColor="rgb(40,30,12)" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${gradientId}-flap)`} />
          </svg>
        </div>
      </div>
    </div>
  )
})

export default PageCurlOverlay
