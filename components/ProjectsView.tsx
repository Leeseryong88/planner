import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { ProjectStore } from '../hooks/useProjectStore';
import { Project, Task, ProjectStatus } from '../types';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, ChevronLeftIcon, ChevronRightIcon, AttachmentIcon } from './icons';
import { useIsMobile } from '../hooks/useIsMobile';

type CardSize = 'sm' | 'md';

// Simple renderer that supports pasted image markdown or direct/Storage image URLs
const TaskContentPreview: React.FC<{ text?: string }> = ({ text }) => {
  if (!text) return null;
  const t = text.trim();
  if (!t) return null;
  const lines = t.split('\n');
  return (
    <div className="text-[11px] text-text-secondary line-clamp-2 overflow-hidden">
      {lines.map((line, idx) => {
        const md = line.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/);
        let src = md ? md[1] : null;
        if (!src) {
          const anyUrl = line.match(/https?:\/\/[^\s)]+/);
          if (anyUrl && (/\.(png|jpg|jpeg|gif|webp)(\?|#|$)/i.test(anyUrl[0]) || anyUrl[0].includes('firebasestorage.googleapis.com'))) {
            src = anyUrl[0];
          }
        }
        if (src) {
          return <img key={idx} src={src} alt="image" className="max-w-full max-h-28 rounded border border-border-color" />;
        }
        return <p key={idx} className="whitespace-pre-wrap">{line}</p>;
      })}
    </div>
  );
};

const TaskItem: React.FC<{ 
  task: Task; 
  projectStatus?: ProjectStatus; 
  priority?: number; 
  size?: CardSize;
  onPreview?: (task: Task, clientPos: { x: number; y: number }) => void;
  onPreviewEnd?: () => void;
}> = ({ task, projectStatus, priority, size = 'md', onPreview, onPreviewEnd }) => {
  const truncateTitle = (s?: string) => {
    const t = s || '';
    return t.length > 4 ? `${t.slice(0, 4)}...` : t;
  };
  const isProjectCompleted = projectStatus === ProjectStatus.Completed;
  const isCompleted = task.completed || isProjectCompleted;
  const completionDate = task.completionDate ? new Date(task.completionDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit'}) : null;

  let bgClass = 'bg-secondary';
  let borderClass = 'border-border-color';
  let titleClass = 'text-text-main';
  let dateClass = 'text-text-secondary';

  const sizeClasses = {
    md: { card: 'w-56 h-24 p-3', title: 'text-sm', date: 'text-xs', badge: 'w-5 h-5 text-xs' },
  } as const;

  if (isCompleted) {
    bgClass = 'bg-gray-100';
    borderClass = 'border-gray-300';
    titleClass = 'text-gray-500';
    if (isProjectCompleted) {
        titleClass += ' line-through';
    }
    dateClass = 'text-gray-500';
  } else if (priority === 1) {
    bgClass = 'bg-sky-200';
    borderClass = 'border-sky-300';
    titleClass = 'text-sky-700';
    dateClass = 'text-sky-600';
  }

  // Small mode: completed = gray dot, not-completed = blue priority badge
  if (size === 'sm') {
    const isDone = isCompleted;
    const titleStyle = isDone ? 'text-gray-500' : 'text-text-main';
    const handleMove = (e: React.MouseEvent) => {
      onPreview?.(task, { x: e.clientX, y: e.clientY });
    };
    return (
      <div 
        className="flex flex-col items-center justify-start w-20 h-10 select-none"
        onMouseEnter={(e) => onPreview?.(task, { x: e.clientX, y: e.clientY })}
        onMouseMove={handleMove}
        onMouseLeave={() => onPreviewEnd?.()}
      >
        {/* Fixed icon row height to keep line height consistent */}
        <div className="h-6 flex items-center justify-center">
          {isDone ? (
            <div className="rounded-full bg-gray-400 w-5 h-5" />
          ) : (
            <div className="flex items-center justify-center rounded-full bg-sky-500 text-white w-5 h-5 text-[10px] font-bold leading-none">
              {priority ?? '•'}
            </div>
          )}
        </div>
        <p className={`mt-1 text-[11px] leading-tight text-center line-clamp-1 ${titleStyle}`}>{truncateTitle(task.title)}</p>
      </div>
    );
  }

  // Default (md)
  return (
    <div className={`relative rounded-lg border flex flex-col justify-between shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${bgClass} ${borderClass} ${sizeClasses.md.card}`}>
      {priority && !isCompleted && (
        <span className={`absolute -top-2 -right-2 text-white font-bold rounded-full flex items-center justify-center shadow-md ${sizeClasses.md.badge} ${priority === 1 ? 'bg-accent' : 'bg-gray-400'}`}>
          {priority === 1 ? '★' : priority}
        </span>
      )}
      <div className="flex items-start justify-between gap-2">
        <p className={`font-semibold ${sizeClasses.md.title} ${titleClass}`}>{truncateTitle(task.title)}</p>
        {task.fileURL && (
          <AttachmentIcon className="w-4 h-4 text-text-secondary flex-shrink-0" title="첨부파일 있음" />
        )}
      </div>
      <TaskContentPreview text={task.content} />
      <div className="flex items-center justify-between">
        <span className="invisible select-none">.</span>
        {isCompleted && completionDate ? (
          <span className={`text-xs text-green-600`}>✓ {completionDate} 완료</span>
        ) : (
          <span className={`${sizeClasses.md.date} ${dateClass}`}>{task.endDate || task.date || ''}</span>
        )}
      </div>
    </div>
  );
};


const ProjectItem: React.FC<{ project: Project; onClick: () => void; compact?: boolean }> = ({ project, onClick, compact }) => {
  const parseDate = (s?: string): Date | null => {
    if (!s) return null;
    const parts = s.split('-').map(Number);
    if (parts.length !== 3) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };
  const start = project.date;
  const end = project.endDate;
  const display = start && end ? `${start} ~ ${end}` : (start || end || '');
  const endDate = parseDate(end || undefined);
  const today = new Date(); today.setHours(0,0,0,0);
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
  const isEndingSoon = !!endDate && (endDate.getTime() - today.getTime()) <= twoWeeksMs;
  const dateClass = isEndingSoon ? 'text-red-600 font-semibold' : 'text-text-secondary';
  const statusClasses = project.status === ProjectStatus.Completed ? 'bg-gray-100 border-gray-300' : 'bg-secondary border-accent';
  const wrapperClasses = compact
    ? `relative p-3 rounded-xl border w-full min-h-[88px] flex flex-col justify-between shadow-md ${statusClasses}`
    : `relative p-4 rounded-lg border-2 w-full min-w-[12rem] max-w-[18rem] sm:w-56 h-24 flex flex-col justify-between shadow-md ${statusClasses}`;
  const titleSize = compact ? 'text-sm' : 'text-base';
  const dateSize = compact ? 'text-[11px]' : 'text-xs';

  return (
    <div 
      onClick={onClick}
      className={`${wrapperClasses} transition-all hover:shadow-lg hover:scale-[1.01] cursor-pointer`}
      title="캔버스에서 보기"
    >
      <h3 className={`font-bold ${titleSize} ${project.status === ProjectStatus.Completed ? 'text-text-secondary' : 'text-text-main'} truncate`}>{project.title}</h3>
      <span className={`${dateSize} ${dateClass} truncate`}>{display}</span>
      {project.status === ProjectStatus.Completed && !compact && (
        <CheckIcon className="w-6 h-6 text-success absolute -top-3 -right-3 bg-secondary rounded-full p-1 border border-gray-300" />
      )}
    </div>
  );
};

const Connector: React.FC = () => (
    <div className="flex items-center justify-center w-12 mx-2">
        <div className="w-full h-0.5 bg-border-color rounded-full"></div>
    </div>
);

const TaskBranch: React.FC<{ task: Task; childTasksByParentId: Map<string, Task[]>; projectStatus?: ProjectStatus, prioritizedTaskIds: string[], size?: CardSize }> = ({ task, childTasksByParentId, projectStatus, prioritizedTaskIds, size = 'md' }) => {
    const children = childTasksByParentId.get(task.id) || [];
    const priority = prioritizedTaskIds.indexOf(task.id);
    const isProjectCompleted = projectStatus === ProjectStatus.Completed;

    const taskStyle = isProjectCompleted ? { textDecoration: 'none', color: '#6b7280' } : {};


    return (
        <div className="flex items-center">
            <TaskItem task={task} projectStatus={projectStatus} priority={priority > -1 ? priority + 1 : undefined} size={size} />
            {children.length > 0 && (
                <>
                    <Connector />
                    <div className="flex flex-col gap-4 items-start">
                        {children.map(child => (
                            <TaskBranch key={child.id} task={child} childTasksByParentId={childTasksByParentId} projectStatus={projectStatus} prioritizedTaskIds={prioritizedTaskIds} size={size} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};


const ProjectRow: React.FC<{
    project: Project;
    onProjectClick: (id: string) => void;
    childTasksByParentId: Map<string, Task[]>;
    store: ProjectStore;
    size: CardSize;
    isMobile?: boolean;
}> = ({ project, onProjectClick, childTasksByParentId, store, size, isMobile }) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [showLeft, setShowLeft] = React.useState(false);
    const [showRight, setShowRight] = React.useState(false);
    const isDraggingRef = React.useRef(false);
    const startXRef = React.useRef(0);
    const startScrollRef = React.useRef(0);
    const [preview, setPreview] = React.useState<{ task: Task | null; pos: { x: number; y: number } }>({ task: null, pos: { x: 0, y: 0 } });
    // Always derive tasks from the global store to avoid brief empty states during snapshots
    const projectTasks = React.useMemo(() => store.tasks.filter(t => t.projectId === project.id), [store.tasks, project.id]);

    const updateArrows = React.useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        setShowLeft(scrollLeft > 4);
        setShowRight(scrollLeft + clientWidth < scrollWidth - 4);
    }, []);

    React.useEffect(() => {
        updateArrows();
        const el = scrollRef.current;
        if (!el) return;
        const onScroll = () => updateArrows();
        el.addEventListener('scroll', onScroll, { passive: true });
        const ro = new ResizeObserver(() => updateArrows());
        ro.observe(el);
        return () => {
            el.removeEventListener('scroll', onScroll);
            ro.disconnect();
        };
    }, [updateArrows, project.tasks.length]);

    const scrollByAmount = (dir: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;
        const amount = Math.max(320, Math.floor(el.clientWidth * 0.8));
        el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
    };

    // Drag to scroll
    React.useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const onDown = (e: MouseEvent) => {
            isDraggingRef.current = true;
            el.classList.add('cursor-grabbing');
            startXRef.current = e.clientX;
            startScrollRef.current = el.scrollLeft;
        };
        const onMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const dx = e.clientX - startXRef.current;
            el.scrollLeft = startScrollRef.current - dx;
        };
        const onUp = () => {
            isDraggingRef.current = false;
            el.classList.remove('cursor-grabbing');
        };
        el.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        // touch
        const onTouchStart = (e: TouchEvent) => {
            isDraggingRef.current = true;
            startXRef.current = e.touches[0].clientX;
            startScrollRef.current = el.scrollLeft;
        };
        const onTouchMove = (e: TouchEvent) => {
            if (!isDraggingRef.current) return;
            const dx = e.touches[0].clientX - startXRef.current;
            el.scrollLeft = startScrollRef.current - dx;
        };
        const onTouchEnd = () => { isDraggingRef.current = false; };
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: true });
        el.addEventListener('touchend', onTouchEnd);
        return () => {
            el.removeEventListener('mousedown', onDown);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, []);

    // Row/Depth layout so deeper 노드들도 정확한 행에 정렬
    const layout = React.useMemo(() => {
        // Build global children mapping already provided; collect subtree starting at this project's roots
        const roots = projectTasks.filter(t => !t.parentTaskId);
        const inSet = new Set<string>();
        const collect = (t: Task) => {
            if (inSet.has(t.id)) return;
            inSet.add(t.id);
            const kids = childTasksByParentId.get(t.id) || [];
            kids.forEach(collect);
        };
        roots.forEach(collect);
        if (roots.length === 0) return { depthKeys: [] as number[], columns: new Map<number, Task[]>(), rowOf: new Map<string, number>() };
        // subtree rows cache
        const getRows = (id: string, cache = new Map<string, number>()): number => {
            if (cache.has(id)) return cache.get(id)!;
            const kids = (childTasksByParentId.get(id) || []).filter(k => inSet.has(k.id));
            if (kids.length === 0) { cache.set(id, 1); return 1; }
            let sum = 0;
            for (const k of kids) sum += getRows(k.id, cache);
            sum = Math.max(sum, 1);
            cache.set(id, sum);
            return sum;
        };
        const rowOf = new Map<string, number>();
        const depthOf = new Map<string, number>();
        let currentRow = 0;
        const assign = (t: Task, depth: number, startRow: number) => {
            const rows = getRows(t.id);
            const myRow = startRow + Math.floor((rows - 1) / 2);
            rowOf.set(t.id, myRow);
            depthOf.set(t.id, depth);
            const kids = (childTasksByParentId.get(t.id) || []).filter(k => inSet.has(k.id));
            let s = startRow;
            for (const k of kids) {
                const need = getRows(k.id);
                assign(k, depth + 1, s);
                s += need;
            }
        };
        // stable order for roots
        roots.sort((a, b) => (a.title || '').localeCompare(b.title || '') || a.id.localeCompare(b.id));
        for (const r of roots) {
            const need = getRows(r.id);
            assign(r, 1, currentRow);
            currentRow += need + 1;
        }
        const columns = new Map<number, Task[]>();
        const tasksById = new Map(store.tasks.map(t => [t.id, t]));
        inSet.forEach(id => {
            const t = tasksById.get(id);
            if (!t) return;
            const d = depthOf.get(id);
            if (d === undefined) return;
            const arr = columns.get(d) || [];
            arr.push(t);
            columns.set(d, arr);
        });
        const depthKeys = Array.from(columns.keys()).sort((a,b)=>a-b);
        depthKeys.forEach(d => columns.get(d)!.sort((a,b)=> (rowOf.get(a.id)! - rowOf.get(b.id)!)));
        return { depthKeys, columns, rowOf };
    }, [projectTasks, childTasksByParentId, store.tasks]);

    // Filtered 우선순위 인덱스 (실제 유효한 작업만 계산)
    const prioritizedDisplayOrder = React.useMemo(() => {
        const uniqueIds = Array.from(new Set(store.prioritizedTaskIds));
        const tasksById = new Map(store.tasks.map(t => [t.id, t]));
        const projectsById = new Map(store.projects.map(p => [p.id, p]));
        const findRoot = (taskId: string): Project | null => {
            const seen = new Set<string>();
            let cur: string | undefined = taskId;
            while (cur && !seen.has(cur)) {
                seen.add(cur);
                const t = tasksById.get(cur);
                if (!t) return null;
                if (t.projectId) return projectsById.get(t.projectId) || null;
                cur = t.parentTaskId || undefined;
            }
            return null;
        };
        return uniqueIds.filter(id => {
            const t = tasksById.get(id);
            if (!t || t.completed) return false;
            const root = findRoot(id);
            return !root || root?.status === ProjectStatus.InProgress;
        });
    }, [store.prioritizedTaskIds, store.tasks, store.projects]);

    const rowClass = `flex ${isMobile ? 'items-start gap-3 p-3' : 'items-center p-4'} bg-primary rounded-lg shadow-inner transition-opacity duration-300 ${project.status === ProjectStatus.Completed ? 'opacity-70 hover:opacity-100' : ''}`;

    return (
        <div className={rowClass}>
            <div className="flex-shrink-0 relative min-w-[9rem]">
                <ProjectItem project={project} onClick={() => onProjectClick(project.id)} compact={isMobile} />
                {project.status === ProjectStatus.Completed && (
                    <button 
                        onClick={() => store.toggleProjectCollapse(project.id)}
                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-secondary hover:bg-gray-100 rounded-full p-1 border border-gray-300 shadow-md transition-transform hover:scale-110 z-10"
                        title={project.isCollapsed ? '펼치기' : '접기'}
                    >
                        {project.isCollapsed ? <ChevronDownIcon className="w-4 h-4 text-text-secondary"/> : <ChevronUpIcon className="w-4 h-4 text-text-secondary" />}
                    </button>
                )}
            </div>
            
            {projectTasks.length > 0 && layout.depthKeys.length > 0 && !(project.status === ProjectStatus.Completed && project.isCollapsed) && (
                <>
                    <div className="relative flex-1 min-w-0">
                        {/* Horizontal slider container */}
                        <div
                            ref={scrollRef}
                            className="w-full overflow-x-auto overflow-y-hidden cursor-grab select-none no-scrollbar"
                            style={{ scrollBehavior: 'smooth' }}
                        >
                            <div className={`flex flex-row items-start whitespace-nowrap snap-x snap-mandatory ${size === 'sm' ? 'gap-0 pr-10' : 'gap-0 pr-12'}`}>
                                {layout.depthKeys.map((depth, idx) => (
                                    <React.Fragment key={idx}>
                                        <div className="inline-flex snap-start">
                                            <div className={`flex flex-col items-start`} style={{ position: 'relative' }}>
                                                {(() => {
                                                    const items = layout.columns.get(depth)!;
                                                    const rowUnit = size === 'sm' ? 40 : 104;
                                                    let lastRow = -1;
                                                    return items.map(task => {
                                                        const r = layout.rowOf.get(task.id)!;
                                                        const spacerRows = r - lastRow - 1;
                                                        lastRow = r;
                                                        const prioIndex = prioritizedDisplayOrder.indexOf(task.id);
                                                        const priority = prioIndex > -1 ? prioIndex + 1 : undefined;
                                                        return (
                                                            <React.Fragment key={task.id}>
                                                                {spacerRows > 0 && <div style={{ height: spacerRows * rowUnit }} />}
                                                                <TaskItem
                                                                    task={task}
                                                                    projectStatus={project.status}
                                                                    priority={priority}
                                                                    size={size}
                                                                    onPreview={(t, pos) => setPreview({ task: t, pos })}
                                                                    onPreviewEnd={() => setPreview({ task: null, pos: { x: 0, y: 0 } })}
                                                                />
                                                            </React.Fragment>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                        {showLeft && (
                            <button
                                onClick={() => scrollByAmount('left')}
                                className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full shadow p-1 border border-border-color"
                                aria-label="왼쪽으로 스크롤"
                            >
                                <ChevronLeftIcon className="w-5 h-5" />
                            </button>
                        )}
                        {showRight && (
                            <button
                                onClick={() => scrollByAmount('right')}
                                className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full shadow p-1 border border-border-color"
                                aria-label="오른쪽으로 스크롤"
                            >
                                <ChevronRightIcon className="w-5 h-5" />
                            </button>
                        )}
                        {/* Small mode hover preview */}
                        {size === 'sm' && preview.task && (
                            <div
                                className="fixed z-50 pointer-events-none"
                                style={{ left: preview.pos.x + 14, top: preview.pos.y + 14 }}
                            >
                                <div className="w-64 p-3 rounded-lg border bg-white shadow-xl">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="font-semibold text-sm text-text-main">{preview.task.title}</p>
                                        {preview.task.fileURL && <AttachmentIcon className="w-4 h-4 text-text-secondary" />}
                                    </div>
                                    <p className="text-xs text-text-secondary mt-1 line-clamp-3">{preview.task.content}</p>
                                    <div className="text-xs text-text-secondary mt-2 text-right">
                                        {preview.task.endDate || preview.task.date || ''}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};


const reorderWithInsert = (order: string[], dragId: string, insertIndex: number) => {
    const filtered = order.filter(id => id !== dragId);
    const clamped = Math.max(0, Math.min(insertIndex, filtered.length));
    filtered.splice(clamped, 0, dragId);
    return filtered;
};

const TaskPriorityView: React.FC<{ store: ProjectStore }> = ({ store }) => {
    const { projects, tasks, prioritizedTaskIds, setPrioritizedTasks } = store;

    const tasksById = useMemo(() => tasks.reduce((acc, t) => {
        acc[t.id] = t;
        return acc;
    }, {} as Record<string, Task>), [tasks]);

    const projectsById = useMemo(() => projects.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
    }, {} as Record<string, Project>), [projects]);

    const findRootProjectForTask = useCallback((taskId: string): Project | null => {
        const visited = new Set<string>();
        let currentId: string | undefined = taskId;
        while (currentId && !visited.has(currentId)) {
            visited.add(currentId);
            const task = tasksById[currentId];
            if (!task) return null;
            if (task.projectId) return projectsById[task.projectId] || null;
            currentId = task.parentTaskId || undefined;
        }
        return null;
    }, [tasksById, projectsById]);
    
    const tasksForPrioritization = useMemo(() => {
        return tasks.filter(task => {
            if (task.completed) {
                return false;
            }
            const rootProject = findRootProjectForTask(task.id);
            // include unlinked tasks as well
            return !rootProject || rootProject?.status === ProjectStatus.InProgress;
        });
    }, [tasks, findRootProjectForTask]);

    const sortedTasks = useMemo(() => {
        const uniqueIds = Array.from(new Set(prioritizedTaskIds));
        const prioritized = uniqueIds
            .map(id => tasksForPrioritization.find(t => t.id === id))
            .filter((t): t is Task => !!t);

        const unprioritized = tasksForPrioritization.filter(t => !uniqueIds.includes(t.id));

        return [...prioritized, ...unprioritized];
    }, [tasksForPrioritization, prioritizedTaskIds]);
    
    const [dragState, setDragState] = useState<{
        id: string | null;
        pointerId: number | null;
        order: string[];
    }>({ id: null, pointerId: null, order: [] });
    const [dragHover, setDragHover] = useState<{ id: string | null; afterEnd: boolean }>({ id: null, afterEnd: false });
    const holdTimerRef = React.useRef<number | null>(null);
    const holdStartRef = React.useRef<{ x: number; y: number } | null>(null);
    const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        return () => {
            if (holdTimerRef.current) {
                window.clearTimeout(holdTimerRef.current);
                holdTimerRef.current = null;
            }
            document.body.style.userSelect = '';
        };
    }, []);

    const clearHoldTimer = () => {
        if (holdTimerRef.current) {
            window.clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
    };

    const startDrag = useCallback((taskId: string, pointerId: number) => {
        document.body.style.userSelect = 'none';
        setDragState({
            id: taskId,
            pointerId,
            order: sortedTasks.map(t => t.id),
        });
        setDragHover({ id: null, afterEnd: false });
    }, [sortedTasks]);

    const finishDrag = useCallback((commit: boolean) => {
        if (commit && dragState.id) {
            setPrioritizedTasks(dragState.order);
        }
        document.body.style.userSelect = '';
        setDragState({ id: null, pointerId: null, order: [] });
        setDragHover({ id: null, afterEnd: false });
    }, [dragState.id, dragState.order, setPrioritizedTasks]);

    const handlePointerDown = (taskId: string) => (e: React.PointerEvent<HTMLDivElement>) => {
        e.stopPropagation();
        holdStartRef.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
        if (e.pointerType === 'mouse') {
            startDrag(taskId, e.pointerId);
        } else {
            holdTimerRef.current = window.setTimeout(() => {
                startDrag(taskId, e.pointerId);
                holdTimerRef.current = null;
            }, 220);
        }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (holdTimerRef.current && holdStartRef.current) {
            const dx = e.clientX - holdStartRef.current.x;
            const dy = e.clientY - holdStartRef.current.y;
            if (Math.hypot(dx, dy) > 12) {
                clearHoldTimer();
                try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
            }
        }
        if (!dragState.id || dragState.pointerId !== e.pointerId) return;
        e.preventDefault();
        const pointerY = e.clientY;
        const order = dragState.order;
        const dragId = dragState.id;
        const siblings = order.filter(id => id !== dragId);
        let insertIndex = siblings.length;
        let hoverId: string | null = siblings[siblings.length - 1] || null;
        let afterEnd = true;
        for (let i = 0; i < siblings.length; i++) {
            const id = siblings[i];
            const el = itemRefs.current[id];
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            const threshold = rect.top + rect.height / 2;
            if (pointerY < threshold) {
                insertIndex = i;
                hoverId = id;
                afterEnd = false;
                break;
            }
        }
        setDragHover({ id: hoverId, afterEnd: afterEnd && siblings.length > 0 });
        setDragState(prev => ({
            ...prev,
            order: reorderWithInsert(prev.order, dragId, insertIndex),
        }));
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (holdTimerRef.current) {
            clearHoldTimer();
            try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
            return;
        }
        if (dragState.id && dragState.pointerId === e.pointerId) {
            e.preventDefault();
            try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
            finishDrag(true);
        }
    };

    const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
        clearHoldTimer();
        if (dragState.id && dragState.pointerId === e.pointerId) {
            try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
            finishDrag(false);
        }
    };

    const displayTasks = dragState.id
        ? dragState.order.map(id => tasksById[id]).filter((t): t is Task => !!t)
        : sortedTasks;

    if (tasksForPrioritization.length === 0) {
        return (
            <div className="text-center py-12 text-text-secondary">
              <p>우선순위를 정할 작업이 없습니다.</p>
              <p className="text-sm">진행 중인 프로젝트에 작업을 추가하세요.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-3 p-4">
            <h3 className="text-lg font-bold text-text-main mb-4">작업 우선순위 설정</h3>
            <p className="text-sm text-text-secondary mb-4">작업을 드래그하여 우선순위를 변경하세요. 가장 위에 있는 작업이 1순위입니다.</p>
            {displayTasks.map((task, index) => {
                const project = findRootProjectForTask(task.id);
                const isDragging = dragState.id === task.id;
                const isHoverTarget = dragHover.id === task.id && !dragHover.afterEnd;
                return (
                    <div
                        key={task.id}
                        ref={(el) => { itemRefs.current[task.id] = el; }}
                        onPointerDown={handlePointerDown(task.id)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                        className={`flex items-center p-3 rounded-lg border transition-all select-none bg-secondary border-border-color shadow-sm ${
                            isDragging ? 'ring-2 ring-accent shadow-2xl scale-[1.02]' : ''
                        } ${isHoverTarget ? 'ring-2 ring-accent/50' : ''}`}
                        style={{ touchAction: dragState.id ? 'none' : 'manipulation', cursor: dragState.id ? 'grabbing' : 'grab' }}
                    >
                        <div className="flex items-center justify-center w-8 h-8 mr-4 bg-accent text-white rounded-full font-bold text-sm flex-shrink-0">
                            {index + 1}
                        </div>
                        <div className="flex-grow">
                            <p className="font-semibold text-text-main">{task.title}</p>
                            <p className="text-sm text-text-secondary">
                                {project ? `프로젝트: ${project.title}` : '개별 작업'}
                            </p>
                        </div>
                    </div>
                );
            })}
            {dragState.id && dragHover.afterEnd && (
                <div className="h-10 rounded-lg border-2 border-dashed border-accent/60 flex items-center justify-center text-xs text-accent animate-pulse">
                    여기로 이동
                </div>
            )}
        </div>
    );
};

const CompletedProjectGridItem: React.FC<{
  project: Project;
  onProjectClick: (id: string) => void;
  store: ProjectStore;
  compact?: boolean;
}> = ({ project, onProjectClick, store, compact }) => (
  <div className="relative">
    <ProjectItem project={project} onClick={() => onProjectClick(project.id)} compact={compact} />
    <button
      onClick={() => store.toggleProjectCollapse(project.id)}
      className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-secondary hover:bg-gray-100 rounded-full p-1 border border-gray-300 shadow-md transition-transform hover:scale-110 z-10"
      title="펼치기"
    >
      <ChevronDownIcon className="w-4 h-4 text-text-secondary"/>
    </button>
  </div>
);


export const ProjectsView: React.FC<{ store: ProjectStore; onProjectClick: (projectId: string) => void; fixedMode?: 'projects' | 'tasks'; }> = ({ store, onProjectClick, fixedMode }) => {
  const [viewMode, setViewMode] = useState<'projects' | 'tasks'>('tasks');
  const isMobile = useIsMobile();
  const cardSize: CardSize = 'sm';
  const [isCompletedSectionCollapsed, setIsCompletedSectionCollapsed] = useState(false);
  const { projects, tasks } = store;

  const inProgressProjects = useMemo(() => {
    const parse = (d?: string) => (d ? new Date(d).getTime() : Number.POSITIVE_INFINITY);
    return projects
      .filter(p => p.status === ProjectStatus.InProgress)
      .slice()
      .sort((a, b) => parse(a.endDate) - parse(b.endDate));
  }, [projects]);

  const completedProjects = useMemo(() => 
    projects.filter(p => p.status === ProjectStatus.Completed),
  [projects]);

  const expandedCompletedProjects = useMemo(() =>
    completedProjects.filter(p => !p.isCollapsed),
  [completedProjects]);
  
  const collapsedCompletedProjects = useMemo(() =>
    completedProjects.filter(p => p.isCollapsed),
  [completedProjects]);

  const childTasksByParentId = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(task => {
      if (task.parentTaskId) {
        if (!map.has(task.parentTaskId)) {
          map.set(task.parentTaskId, []);
        }
        map.get(task.parentTaskId)!.push(task);
      }
    });
    return map;
  }, [tasks]);

  const renderContent = () => {
    const mode = fixedMode ?? viewMode;
    switch (mode) {
      case 'tasks':
        return <TaskPriorityView store={store} />;
      case 'projects':
      default:
        return (
          <div className="space-y-8">
            <div>
              {inProgressProjects.map(project => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  onProjectClick={onProjectClick}
                  childTasksByParentId={childTasksByParentId}
                  store={store}
                  size={cardSize}
                  isMobile={isMobile}
                />
              ))}
            </div>

            {inProgressProjects.length > 0 && completedProjects.length > 0 && (
              <div className="relative my-12">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-border-color border-dashed"></div>
                </div>
                <div className="relative flex justify-center">
                  <button
                    onClick={() => setIsCompletedSectionCollapsed(!isCompletedSectionCollapsed)}
                    className="flex items-center gap-2 bg-secondary/50 px-4 py-1 rounded-full text-sm font-semibold text-text-secondary hover:bg-primary transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-secondary/50"
                    aria-expanded={!isCompletedSectionCollapsed}
                  >
                    <span>완료된 프로젝트</span>
                    {isCompletedSectionCollapsed ? <ChevronDownIcon className="w-4 h-4"/> : <ChevronUpIcon className="w-4 h-4"/>}
                  </button>
                </div>
              </div>
            )}
            
            {!isCompletedSectionCollapsed && completedProjects.length > 0 && (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-2 gap-y-2 place-items-start">
                    {collapsedCompletedProjects.map(project => (
                      <CompletedProjectGridItem 
                        key={project.id} 
                        project={project} 
                        onProjectClick={onProjectClick} 
                        store={store}
                        compact={isMobile}
                      />
                    ))}
                  </div>
                  
                  {expandedCompletedProjects.length > 0 && (
                    <div className="space-y-8 mt-12 pt-8 border-t border-border-color border-dashed">
                        {expandedCompletedProjects.map(project => (
                            <ProjectRow
                              key={project.id}
                              project={project}
                              onProjectClick={onProjectClick}
                              childTasksByParentId={childTasksByParentId}
                              store={store}
                              size={cardSize}
                              isMobile={isMobile}
                            />
                        ))}
                    </div>
                  )}
                </div>
            )}

            {projects.length === 0 && (
              <div className="text-center py-12 text-text-secondary">
                <p>표시할 프로젝트가 없습니다.</p>
                <p className="text-sm">먼저 캔버스에서 프로젝트를 추가하세요.</p>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="bg-secondary/50 rounded-lg p-4 border border-border-color">
      {!fixedMode && (
        <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 p-1 bg-primary rounded-lg shadow-sm">
                  <button onClick={() => setViewMode('tasks')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${viewMode === 'tasks' ? 'bg-accent text-white shadow' : 'text-text-secondary hover:bg-gray-200'}`}>
                      업무 우선순위
                  </button>
                  <button onClick={() => setViewMode('projects')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${viewMode === 'projects' ? 'bg-accent text-white shadow' : 'text-text-secondary hover:bg-gray-200'}`}>
                      프로젝트별 보기
                  </button>
              </div>
          </div>
      )}
      {renderContent()}
    </div>
  );
};