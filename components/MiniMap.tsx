import React, { useMemo, useRef, useState } from 'react';
import { Project, Task } from '@/types';

type MiniMapProps = {
  projects: Project[];
  tasks: Task[];
  pan: { x: number; y: number };
  zoom: number;
  canvasSize: { width: number; height: number };
  onNavigateTo: (contentX: number, contentY: number) => void;
  className?: string;
  width?: number;
  height?: number;
};

export const MiniMap: React.FC<MiniMapProps> = ({
  projects,
  tasks,
  pan,
  zoom,
  canvasSize,
  onNavigateTo,
  className,
  width = 180,
  height = 140,
}) => {
  // Viewport rectangle in content coords (what user currently sees)
  const viewportContent = useMemo(() => {
    const x = -pan.x / zoom;
    const y = -pan.y / zoom;
    const w = Math.max(1, canvasSize.width / zoom);
    const h = Math.max(1, canvasSize.height / zoom);
    return { x, y, w, h };
  }, [pan, zoom, canvasSize]);

  // Estimate content bounds from nodes
  const bounds = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const p of projects) {
      xs.push(p.position.x);
      ys.push(p.position.y);
    }
    for (const t of tasks) {
      xs.push(t.position.x);
      ys.push(t.position.y);
    }
    if (xs.length === 0 || ys.length === 0) {
      // Default large sandbox
      return { minX: -1200, minY: -900, maxX: 1200, maxY: 900 };
    }
    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);
    // Add generous padding (40%) around content
    const padX = (maxX - minX || 1) * 0.4 + 200;
    const padY = (maxY - minY || 1) * 0.4 + 200;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    minX = cx - (maxX - minX) / 2 - padX;
    maxX = cx + (maxX - minX) / 2 + padX;
    minY = cy - (maxY - minY) / 2 - padY;
    maxY = cy + (maxY - minY) / 2 + padY;
    // Ensure the current viewport is always comfortably inside bounds
    const margin = 400; // extra space around current viewport
    const vx1 = viewportContent.x - margin;
    const vy1 = viewportContent.y - margin;
    const vx2 = viewportContent.x + viewportContent.w + margin;
    const vy2 = viewportContent.y + viewportContent.h + margin;
    minX = Math.min(minX, vx1);
    minY = Math.min(minY, vy1);
    maxX = Math.max(maxX, vx2);
    maxY = Math.max(maxY, vy2);
    // Enforce minimum extent so viewport rectangle stays relatively small
    const minExtentX = 2400;
    const minExtentY = 1800;
    const extentX = maxX - minX;
    const extentY = maxY - minY;
    if (extentX < minExtentX) {
      const extra = (minExtentX - extentX) / 2;
      minX -= extra;
      maxX += extra;
    }
    if (extentY < minExtentY) {
      const extra = (minExtentY - extentY) / 2;
      minY -= extra;
      maxY += extra;
    }
    return { minX, minY, maxX, maxY };
  }, [projects, tasks, viewportContent]);

  const scale = useMemo(() => {
    const contentW = (bounds.maxX - bounds.minX) || 1;
    const contentH = (bounds.maxY - bounds.minY) || 1;
    const s = Math.min(width / contentW, height / contentH);
    // Guard against invalid scale (NaN/Infinity/0)
    if (!isFinite(s) || s <= 0) return 0.1;
    return s;
  }, [bounds, width, height]);

  const toMap = (cx: number, cy: number) => {
    return {
      x: (cx - bounds.minX) * scale,
      y: (cy - bounds.minY) * scale,
    };
  };

  const fromMap = (mx: number, my: number) => {
    return {
      x: mx / scale + bounds.minX,
      y: my / scale + bounds.minY,
    };
  };

  const viewportMap = useMemo(() => {
    const clamp = (v: number, minV: number, maxV: number) => Math.max(minV, Math.min(maxV, v));
    const tl = toMap(viewportContent.x, viewportContent.y);
    const br = toMap(viewportContent.x + viewportContent.w, viewportContent.y + viewportContent.h);
    let x = tl.x;
    let y = tl.y;
    let w = br.x - tl.x;
    let h = br.y - tl.y;
    if (!isFinite(x)) x = 0;
    if (!isFinite(y)) y = 0;
    if (!isFinite(w) || w <= 0) w = 8;
    if (!isFinite(h) || h <= 0) h = 8;
    w = Math.max(8, w);
    h = Math.max(8, h);
    // Keep rectangle within svg area
    x = clamp(x, 0, Math.max(0, width - w));
    y = clamp(y, 0, Math.max(0, height - h));
    return { x, y, w, h };
  }, [viewportContent, width, height]);

  const isDragging = useRef(false);

  const handleDown = (e: React.MouseEvent<SVGRectElement | SVGSVGElement>) => {
    isDragging.current = true;
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { x, y } = fromMap(mx, my);
    onNavigateTo(x, y);
  };
  const handleMove = (e: React.MouseEvent<SVGRectElement | SVGSVGElement>) => {
    if (!isDragging.current) return;
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { x, y } = fromMap(mx, my);
    onNavigateTo(x, y);
  };
  const handleUp = () => {
    isDragging.current = false;
  };

  return (
    <div
      className={`pointer-events-auto bg-white/90 backdrop-blur-md border border-border-color rounded-md shadow-lg ${className || ''}`}
      style={{ width, height }}
      onMouseLeave={handleUp}
    >
      <svg
        width={width}
        height={height}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        style={{ cursor: 'crosshair' }}
      >
        {/* Background */}
        <rect x={0} y={0} width={width} height={height} fill="var(--color-primary)" />

        {/* Projects */}
        {projects.map((p) => {
          const m = toMap(p.position.x, p.position.y);
          return <circle key={`p-${p.id}`} cx={m.x} cy={m.y} r={4} fill="var(--color-accent)" opacity={0.9} />;
        })}

        {/* Tasks */}
        {tasks.map((t) => {
          const m = toMap(t.position.x, t.position.y);
          return <circle key={`t-${t.id}`} cx={m.x} cy={m.y} r={2.5} fill="var(--color-text-secondary)" opacity={0.8} />;
        })}

        {/* Viewport rectangle */}
        <rect
          x={viewportMap.x}
          y={viewportMap.y}
          width={viewportMap.w}
          height={viewportMap.h}
          fill="rgba(0,0,0,0.08)"
          stroke="var(--color-accent)"
          strokeWidth={1}
          rx={3}
          ry={3}
          shapeRendering="crispEdges"
        />
      </svg>
    </div>
  );
};


