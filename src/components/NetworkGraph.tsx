'use client'

import { useEffect, useRef, useState } from 'react'
// Narrow d3 submodule imports — pulls in only force/zoom/drag/selection/interpolate
// instead of the entire d3 bundle (~220 KB → ~70 KB on the /network route).
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
  type SimulationNodeDatum,
} from 'd3-force'
import { drag } from 'd3-drag'
import { interpolateRgbBasis } from 'd3-interpolate'
import 'd3-transition' // side-effect: augments selection.prototype.transition()

interface NodeIn { id: string; count: number }
interface EdgeIn { source: string; target: string; weight: number }
interface Props   { nodes: NodeIn[]; edges: EdgeIn[] }

type GNode = NodeIn & SimulationNodeDatum & { degree: number }
type GEdge = { source: GNode | string; target: GNode | string; weight: number }

const NODE_R   = 16
const STORE_KEY = 'muts-network-pos-v1'

function loadPos(): Record<string, { x: number; y: number }> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') } catch { return {} }
}
function savePos(p: Record<string, { x: number; y: number }>) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(p)) } catch {}
}

// Heat gradient: blue → teal → amber → orange → red
function heatColor(t: number): string {
  return interpolateRgbBasis(['#3b82f6', '#10b981', '#f59e0b', '#f97316', '#ef4444'])(t)
}

export default function NetworkGraph({ nodes: nodesIn, edges: edgesIn }: Props) {
  const svgRef  = useRef<SVGSVGElement | null>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const posRef  = useRef<Record<string, { x: number; y: number }>>(loadPos())

  const [selected, setSelected] = useState<{
    id: string; count: number; degree: number
    neighbours: { name: string; weight: number }[]
  } | null>(null)
  const [minWeight, setMinWeight] = useState(1)
  const [layoutKey, setLayoutKey] = useState(0)
  const [hasSaved,  setHasSaved]  = useState(() => Object.keys(loadPos()).length > 0)

  useEffect(() => {
    if (!svgRef.current) return
    const svgEl = svgRef.current
    const svg   = select(svgEl)
    svg.selectAll('*').remove()

    const W = svgEl.clientWidth  || 900
    const H = svgEl.clientHeight || 660

    // ── Data prep ────────────────────────────────────────────────────────
    const rawEdges = edgesIn.filter((e) => e.weight >= minWeight)
    const referenced = new Set(rawEdges.flatMap((e) => [e.source, e.target]))

    const degMap = new Map<string, number>()
    rawEdges.forEach(({ source, target }) => {
      degMap.set(source, (degMap.get(source) ?? 0) + 1)
      degMap.set(target, (degMap.get(target) ?? 0) + 1)
    })

    const nodes: GNode[] = nodesIn
      .filter((n) => referenced.has(n.id))
      .map((n) => {
        const saved = posRef.current[n.id]
        return {
          ...n,
          degree: degMap.get(n.id) ?? 0,
          x:  saved?.x ?? W / 2 + (Math.random() - 0.5) * 120,
          y:  saved?.y ?? H / 2 + (Math.random() - 0.5) * 120,
          fx: saved ? saved.x : null,
          fy: saved ? saved.y : null,
        }
      })

    const edges: GEdge[] = rawEdges.map((e) => ({ ...e }))

    if (!nodes.length) {
      svg.append('text')
        .attr('x', W / 2).attr('y', H / 2).attr('text-anchor', 'middle')
        .attr('fill', 'var(--color-ink-muted)').attr('font-size', '13')
        .text('لا توجد ارتباطات كافية للعرض')
      return
    }

    const maxDeg = Math.max(1, ...nodes.map((n) => n.degree))

    // ── Zoom ─────────────────────────────────────────────────────────────
    const container = svg.append('g')

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 12])
      .on('zoom', (e) => container.attr('transform', e.transform.toString()))

    svg.call(zoomBehavior).on('dblclick.zoom', null)
    zoomRef.current = zoomBehavior

    // ── Simulation ───────────────────────────────────────────────────────
    const sim = forceSimulation<GNode>(nodes)
      .force('link',    forceLink<GNode, GEdge>(edges).id((d) => d.id).distance(90).strength(0.5))
      .force('charge',  forceManyBody<GNode>().strength(-300))
      .force('center',  forceCenter(W / 2, H / 2))
      .force('collide', forceCollide<GNode>().radius(NODE_R + 8))

    // ── Links ─────────────────────────────────────────────────────────────
    const linkSel = container.append('g')
      .selectAll<SVGLineElement, GEdge>('line')
      .data(edges).join('line')
      .attr('stroke', 'var(--color-border)')
      .attr('stroke-width', (d) => Math.min(4.5, 0.5 + Math.sqrt(d.weight)))
      .attr('stroke-opacity', 0.45)

    // ── Drag ──────────────────────────────────────────────────────────────
    const dragBehavior = drag<SVGCircleElement, GNode>()
      .on('start', (ev, d) => {
        ev.sourceEvent.stopPropagation()
        if (!ev.active) sim.alphaTarget(0.3).restart()
        d.fx = d.x; d.fy = d.y
      })
      .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y })
      .on('end', (ev, d) => {
        if (!ev.active) sim.alphaTarget(0)
        // Keep pinned at drop position and persist
        d.fx = ev.x; d.fy = ev.y
        posRef.current[d.id] = { x: ev.x, y: ev.y }
        savePos(posRef.current)
        setHasSaved(true)
      })

    // ── Nodes ─────────────────────────────────────────────────────────────
    const nodeSel = container.append('g')
      .selectAll<SVGCircleElement, GNode>('circle')
      .data(nodes).join('circle')
      .attr('r', NODE_R)
      .attr('fill', (d) => heatColor(d.degree / maxDeg))
      .attr('stroke', 'var(--color-paper)')
      .attr('stroke-width', 2.5)
      .style('cursor', 'grab')
      .call(dragBehavior)
      .on('click', (ev, d) => {
        ev.stopPropagation()
        const neighbours = edges
          .filter((e) => (e.source as GNode).id === d.id || (e.target as GNode).id === d.id)
          .map((e) => {
            const o = (e.source as GNode).id === d.id ? e.target as GNode : e.source as GNode
            return { name: o.id, weight: e.weight }
          })
          .sort((a, b) => b.weight - a.weight)
        setSelected({ id: d.id, count: d.count, degree: d.degree, neighbours })
      })

    // ── Labels ────────────────────────────────────────────────────────────
    const labelSel = container.append('g')
      .attr('pointer-events', 'none')
      .selectAll<SVGTextElement, GNode>('text')
      .data(nodes).join('text')
      .text((d) => d.id)
      .attr('font-size', '10')
      .attr('font-family', 'var(--font-cairo, Arial)')
      .attr('font-weight', '700')
      .attr('fill', 'var(--color-ink)')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'hanging')

    // ── Tick ──────────────────────────────────────────────────────────────
    sim.on('tick', () => {
      linkSel
        .attr('x1', (d) => (d.source as GNode).x ?? 0)
        .attr('y1', (d) => (d.source as GNode).y ?? 0)
        .attr('x2', (d) => (d.target as GNode).x ?? 0)
        .attr('y2', (d) => (d.target as GNode).y ?? 0)
      nodeSel
        .attr('cx', (d) => d.x ?? 0)
        .attr('cy', (d) => d.y ?? 0)
      labelSel
        .attr('x', (d) => d.x ?? 0)
        .attr('y', (d) => (d.y ?? 0) + NODE_R + 2)
    })

    return () => { sim.stop() }
  }, [nodesIn, edgesIn, minWeight, layoutKey])

  // ── Zoom controls ────────────────────────────────────────────────────────
  function zoomBy(k: number) {
    if (!svgRef.current || !zoomRef.current) return
    select(svgRef.current).transition().duration(220).call(zoomRef.current.scaleBy, k)
  }
  function zoomReset() {
    if (!svgRef.current || !zoomRef.current) return
    select(svgRef.current).transition().duration(320).call(zoomRef.current.transform, zoomIdentity)
  }
  function resetLayout() {
    posRef.current = {}
    try { localStorage.removeItem(STORE_KEY) } catch {}
    setHasSaved(false)
    setLayoutKey((k) => k + 1)
  }

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-[1fr_290px] gap-5">

      {/* ── Graph panel ─────────────────────────────────────────────────── */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border-soft)] overflow-hidden flex flex-col min-h-0">

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border-soft)] flex-wrap gap-y-2">
          <label className="inline-flex items-center gap-2 text-[11px]">
            <span className="font-bold uppercase tracking-widest text-[var(--color-ink-muted)]">الحد الأدنى</span>
            <input type="range" min="1" max="10" value={minWeight}
              onChange={(e) => setMinWeight(+e.target.value)}
              className="accent-[var(--color-primary)] w-28" />
            <span className="font-mono tabular-nums text-[var(--color-ink)] w-5">{minWeight}+</span>
          </label>

          <div className="flex items-center gap-2">
            {hasSaved && (
              <button onClick={resetLayout}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-red-300 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                مسح المواضع
              </button>
            )}
            <div className="flex border border-[var(--color-border)] rounded-lg overflow-hidden text-[var(--color-ink-muted)]">
              <button onClick={() => zoomBy(1.4)}
                className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-surface-2)] transition-colors text-lg leading-none">
                +
              </button>
              <button onClick={zoomReset}
                title="إعادة الضبط"
                className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-surface-2)] transition-colors border-x border-[var(--color-border)] text-[11px] font-bold">
                ⌂
              </button>
              <button onClick={() => zoomBy(1 / 1.4)}
                className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-surface-2)] transition-colors text-lg leading-none">
                −
              </button>
            </div>
          </div>
        </div>

        {/* Heat legend bar */}
        <div className="flex items-center gap-2 px-4 py-2 text-[10px] text-[var(--color-ink-muted)] border-b border-[var(--color-border-soft)]"
             dir="ltr">
          <span className="shrink-0">أقل ارتباطاً</span>
          <div className="flex-1 h-2 rounded-full"
               style={{ background: 'linear-gradient(to right, #3b82f6, #10b981, #f59e0b, #f97316, #ef4444)' }} />
          <span className="shrink-0">أكثر ارتباطاً</span>
        </div>

        {/* SVG canvas — fills remaining panel height */}
        <svg ref={svgRef} className="w-full flex-1 min-h-0 block" />

        <p className="text-center text-[10px] text-[var(--color-ink-muted)] py-2 border-t border-[var(--color-border-soft)]">
          اسحب الخلفية للتحريك · عجلة الماوس للتكبير · اسحب عقدة لتثبيت موضعها
        </p>
      </div>

      {/* ── Detail panel ─────────────────────────────────────────────────── */}
      <aside className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border-soft)] p-5 overflow-y-auto space-y-4 self-start md:max-h-full">

        {/* Color key */}
        <div>
          <p className="text-[10px] font-bold tracking-widest text-[var(--color-ink-muted)] uppercase mb-2">
            مفتاح الألوان
          </p>
          <div className="space-y-1.5">
            {[
              ['#3b82f6', 'ارتباط منخفض'],
              ['#10b981', 'ارتباط متوسط'],
              ['#f59e0b', 'ارتباط عالٍ'],
              ['#ef4444', 'الأكثر ارتباطاً'],
            ].map(([clr, lbl]) => (
              <div key={clr} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: clr }} />
                <span className="text-[11px] text-[var(--color-ink-soft)]">{lbl}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-[var(--color-border-soft)]" />

        {/* Position hint */}
        <div className="text-[11px] text-[var(--color-ink-muted)] space-y-1 bg-[var(--color-surface-2)] rounded-xl p-3 border border-[var(--color-border-soft)]">
          <p className="font-bold text-[var(--color-ink-soft)]">تخصيص المواضع</p>
          <p>اسحب أي عقدة وأفلتها — يحفظ موضعها تلقائياً</p>
          {hasSaved && (
            <p className="text-[var(--color-success,#22c55e)] font-bold">✓ مواضع محفوظة</p>
          )}
        </div>

        <div className="h-px bg-[var(--color-border-soft)]" />

        {/* Selected node detail */}
        {selected ? (
          <div>
            <p className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase font-bold mb-1">
              السورة المختارة
            </p>
            <h3 className="text-[20px] font-bold text-[var(--color-primary)] mb-0.5">{selected.id}</h3>
            <p className="text-[12px] text-[var(--color-ink-muted)] mb-0.5">
              ظهرت في{' '}
              <strong className="text-[var(--color-ink)]">{selected.count}</strong> مجموعة
            </p>
            <p className="text-[12px] text-[var(--color-ink-muted)] mb-4">
              مرتبطة بـ{' '}
              <strong className="text-[var(--color-ink)]">{selected.degree}</strong> سورة
            </p>

            <p className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase font-bold mb-2">
              السور المرتبطة ({selected.neighbours.length})
            </p>
            <ul className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
              {selected.neighbours.map((n) => (
                <li key={n.name} className="flex items-center justify-between text-[13px]">
                  <span className="text-[var(--color-ink-soft)]">{n.name}</span>
                  <span className="text-[11px] font-mono tabular-nums text-[var(--color-ink-muted)] px-1.5 py-0.5 rounded bg-[var(--color-surface-2)]">
                    {n.weight}×
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-[var(--color-primary-soft)] mx-auto mb-3 flex items-center justify-center text-[var(--color-primary)] text-xl font-bold">
              ⊙
            </div>
            <p className="text-[12px] text-[var(--color-ink-muted)]">
              انقر على عقدة في الشبكة لعرض ارتباطاتها
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}
