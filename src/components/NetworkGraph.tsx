'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

interface NodeIn { id: string; count: number }
interface EdgeIn { source: string; target: string; weight: number }
interface Props  { nodes: NodeIn[]; edges: EdgeIn[] }

// d3-friendly mutable shapes
type Node = NodeIn & d3.SimulationNodeDatum
type Edge = { source: Node | string; target: Node | string; weight: number }

export default function NetworkGraph({ nodes: nodesIn, edges: edgesIn }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [selected, setSelected] = useState<{ id: string; count: number; neighbours: { name: string; weight: number }[] } | null>(null)
  const [minWeight, setMinWeight] = useState(1)

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const W = svgRef.current.clientWidth
    const H = 600

    // Filter by minWeight
    const edges: Edge[] = edgesIn
      .filter((e) => e.weight >= minWeight)
      .map((e) => ({ source: e.source, target: e.target, weight: e.weight }))
    const referenced = new Set<string>(edges.flatMap((e) => [e.source as string, e.target as string]))
    const nodes: Node[] = nodesIn
      .filter((n) => referenced.has(n.id))
      .map((n) => ({ ...n }))

    if (!nodes.length) {
      svg.append('text')
        .attr('x', W / 2).attr('y', H / 2).attr('text-anchor', 'middle')
        .attr('fill', 'var(--color-ink-muted)').attr('font-size', '13')
        .text('لا توجد ارتباطات كافية للعرض')
      return
    }

    const sim = d3.forceSimulation<Node>(nodes)
      .force('link', d3.forceLink<Node, Edge>(edges).id((d) => d.id).distance(80).strength(0.6))
      .force('charge', d3.forceManyBody<Node>().strength(-180))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collide', d3.forceCollide<Node>().radius((d) => 8 + (d.count ?? 0) * 1.2))

    const linkSel = svg.append('g')
      .attr('stroke', 'var(--color-border)')
      .selectAll<SVGLineElement, Edge>('line')
      .data(edges)
      .join('line')
      .attr('stroke-width', (d) => Math.min(6, 0.6 + Math.log(d.weight + 1)))
      .attr('stroke-opacity', 0.5)

    const maxCount = Math.max(1, ...nodes.map((n) => n.count))
    const color = d3.scaleSequential(d3.interpolateRgbBasis(['oklch(0.85 0.06 265)', 'oklch(0.45 0.14 265)']))
      .domain([0, maxCount])

    const nodeSel = svg.append('g')
      .attr('stroke', 'var(--color-paper)')
      .attr('stroke-width', 1.5)
      .selectAll<SVGCircleElement, Node>('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d) => 6 + (d.count ?? 0) * 1.0)
      .attr('fill', (d) => color(d.count ?? 0) as string)
      .style('cursor', 'pointer')
      .call(d3.drag<SVGCircleElement, Node>()
        .on('start', (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => {
          if (!event.active) sim.alphaTarget(0)
          d.fx = null; d.fy = null
        }))
      .on('click', (_, d) => {
        const neighbours = edges
          .filter((e) => (e.source as Node).id === d.id || (e.target as Node).id === d.id)
          .map((e) => {
            const other = (e.source as Node).id === d.id ? (e.target as Node) : (e.source as Node)
            return { name: other.id, weight: e.weight }
          })
          .sort((a, b) => b.weight - a.weight)
        setSelected({ id: d.id, count: d.count, neighbours })
      })

    const labelSel = svg.append('g')
      .selectAll<SVGTextElement, Node>('text')
      .data(nodes.filter((n) => n.count >= 2))  // only label important nodes
      .join('text')
      .text((d) => d.id)
      .attr('font-size', '11')
      .attr('font-family', 'var(--font-cairo)')
      .attr('font-weight', '700')
      .attr('fill', 'var(--color-ink)')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle')

    sim.on('tick', () => {
      linkSel
        .attr('x1', (d) => (d.source as Node).x ?? 0)
        .attr('y1', (d) => (d.source as Node).y ?? 0)
        .attr('x2', (d) => (d.target as Node).x ?? 0)
        .attr('y2', (d) => (d.target as Node).y ?? 0)
      nodeSel.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0)
      labelSel.attr('x', (d) => d.x ?? 0).attr('y', (d) => (d.y ?? 0) - (10 + (d.count ?? 0)))
    })

    return () => { sim.stop() }
  }, [nodesIn, edgesIn, minWeight])

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-5">
      {/* Graph */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border-soft)] p-2">
        <div className="flex items-center justify-between gap-3 px-3 pt-2 pb-3">
          <label className="text-[11px] text-[var(--color-ink-soft)] inline-flex items-center gap-2">
            <span className="font-bold uppercase tracking-widest text-[var(--color-ink-muted)]">حد الارتباط</span>
            <input type="range" min="1" max="10" value={minWeight}
              onChange={(e) => setMinWeight(parseInt(e.target.value, 10))}
              className="accent-[var(--color-primary)]" />
            <span className="font-mono tabular-nums">{minWeight}+</span>
          </label>
          <span className="text-[11px] text-[var(--color-ink-muted)] font-mono tabular-nums">
            انقر دائرة للتفاصيل • اسحب للترتيب
          </span>
        </div>
        <svg ref={svgRef} className="w-full h-[600px] block" viewBox={`0 0 800 600`} preserveAspectRatio="xMidYMid meet" />
      </div>

      {/* Detail panel */}
      <aside className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border-soft)] p-5 md:sticky md:top-6 self-start">
        {selected ? (
          <>
            <div className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-1 font-bold">
              السورة المختارة
            </div>
            <h3 className="text-[18px] font-bold text-[var(--color-primary)] mb-1">{selected.id}</h3>
            <p className="text-[12px] text-[var(--color-ink-muted)] mb-4">
              ظهرت في <span className="font-bold tabular-nums text-[var(--color-ink)]">{selected.count}</span> مجموعة
            </p>
            <div className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-2 font-bold">
              السور المرتبطة
            </div>
            <ul className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {selected.neighbours.length === 0 && (
                <li className="text-[12px] text-[var(--color-ink-muted)]">لا توجد ارتباطات.</li>
              )}
              {selected.neighbours.map((n) => (
                <li key={n.name} className="flex items-center justify-between text-[13px]">
                  <span className="text-[var(--color-ink-soft)]">{n.name}</span>
                  <span className="text-[11px] font-mono tabular-nums text-[var(--color-ink-muted)] px-1.5 py-0.5 rounded bg-[var(--color-surface-2)]">
                    {n.weight}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[var(--color-primary-soft)] mx-auto mb-3 flex items-center justify-center text-[var(--color-primary)] font-bold">⊙</div>
            <p className="text-[12px] text-[var(--color-ink-muted)]">
              انقر على دائرة في الشبكة لعرض ارتباطاتها
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}
