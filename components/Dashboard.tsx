import React, { useState, useRef, MouseEvent as ReactMouseEvent, useMemo, useCallback, TouchEvent as ReactTouchEvent, useEffect } from 'react';
import { ProjectStore } from '../hooks/useProjectStore';
import { Modal } from './Modal';
import { ProjectForm } from './ProjectForm';
import { TaskForm } from './TaskForm';
import { PlusIcon, TrashIcon, ProjectsIcon, EditIcon } from './icons';
import { ProjectNode, TaskNode } from './ProjectCard';
import { Task, Project, ProjectStatus } from '../types';
import { ProjectView } from './ProjectView';
import { TaskView } from './TaskView';
import { MiniMap } from './MiniMap';


const LineStyleEditor: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  lineStyle: Task['lineStyle'];
  onSave: (style: Task['lineStyle']) => void;
  onDelete: () => void;
  position: { x: number; y: number };
}> = ({ isOpen, onClose, lineStyle, onSave, onDelete, position }) => {
  if (!isOpen) return null;

  const [color, setColor] = useState(lineStyle?.color || '#d1d5db');
  const [strokeWidth, setStrokeWidth] = useState(lineStyle?.strokeWidth || 2);

  const handleSave = () => {
    onSave({ color, strokeWidth });
    onClose();
  };

  return (
    <div
      className="absolute z-50 bg-secondary rounded-lg shadow-xl p-4 border border-border-color space-y-3"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <h4 className="font-bold text-sm text-text-main">선 편집</h4>
      <div className="flex items-center gap-2">
        <label htmlFor="line-color" className="text-sm text-text-secondary">색상:</label>
        <input id="line-color" type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 p-0 border-none rounded" />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="line-width" className="text-sm text-text-secondary">굵기:</label>
        <input id="line-width" type="range" min="1" max="10" value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} className="w-24" />
        <span className="text-sm">{strokeWidth}px</span>
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-border-color mt-2">
        <button onClick={onDelete} className="p-1 text-red-500 hover:bg-red-100 rounded-full"><TrashIcon className="w-5 h-5"/></button>
        <button onClick={handleSave} className="bg-accent text-white text-sm font-bold py-1 px-3 rounded-md hover:bg-accent-hover">저장</button>
      </div>
    </div>
  );
};

type HoveredNode = { type: 'project' | 'task', data: Project | Task };

export const Dashboard: React.FC<{ 
  store: ProjectStore, 
  focusProjectId?: string | null, 
  onFocusHandled?: () => void 
}> = ({ store, focusProjectId, onFocusHandled }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTaskModalOpen, setTaskModalOpen] = useState(false);
  const [newTaskPos, setNewTaskPos] = useState<{ x: number, y: number } | null>(null);
  const [newProjectPos, setNewProjectPos] = useState<{ x: number; y: number } | null>(null);
  
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.8);
  const [isPanning, setIsPanning] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState({ x: 0, y: 0 });
  const [mouseClientPos, setMouseClientPos] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<HoveredNode | null>(null);

  const [editingLine, setEditingLine] = useState<{ projectId: string; taskId: string; pos: {x: number; y: number} } | null>(null);
  
  const [viewingNode, setViewingNode] = useState<{ type: 'project' | 'task', id: string, pos: { x: number, y: number } } | null>(null);
  const [editingNode, setEditingNode] = useState<{ type: 'project' | 'task', id: string, pos: { x: number, y: number } } | null>(null);

  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [creationMenuPos, setCreationMenuPos] = useState<{ canvasX: number; canvasY: number; clientX: number, clientY: number } | null>(null);
  const [groupPreviewOffset, setGroupPreviewOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [taskPreview, setTaskPreview] = useState<{ id: string | null; offset: { x: number; y: number } }>({ id: null, offset: { x: 0, y: 0 } });


  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const initialFocusIdRef = useRef<string | null>(focusProjectId || null);

  useEffect(() => {
    if (focusProjectId && onFocusHandled && canvasRef.current) {
      const project = store.projects.find(p => p.id === focusProjectId);
      if (project) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const targetZoom = 1;
        
        const newPanX = canvasRect.width / 2 - project.position.x * targetZoom;
        const newPanY = canvasRect.height / 2 - project.position.y * targetZoom;
        
        setZoom(targetZoom);
        setPan({ x: newPanX, y: newPanY });

        onFocusHandled();
      }
    }
  }, [focusProjectId, onFocusHandled, store.projects]);
  
  // Track canvas size with ResizeObserver for accurate viewport rect in minimap
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setCanvasSize({ width: cr.width, height: cr.height });
      }
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    setCanvasSize({ width: rect.width, height: rect.height });
    return () => ro.disconnect();
  }, []);

  // Persist and restore canvas view (pan/zoom) across app tabs
  useEffect(() => {
    // If initial render already has a focus target, skip restoring saved view
    if (initialFocusIdRef.current) return;
    try {
      const raw = localStorage.getItem('canvas:view');
      if (raw) {
        const obj = JSON.parse(raw);
        if (typeof obj?.pan?.x === 'number' && typeof obj?.pan?.y === 'number') {
          setPan({ x: obj.pan.x, y: obj.pan.y });
        }
        if (typeof obj?.zoom === 'number') {
          setZoom(obj.zoom);
        }
      }
    } catch {}
    // run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem('canvas:view', JSON.stringify({ pan, zoom }));
      } catch {}
    }, 200);
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [pan, zoom]);
  
  const tasksById = useMemo(() =>
    store.tasks.reduce((acc, t) => {
      acc[t.id] = t;
      return acc;
    }, {} as Record<string, Task>),
  [store.tasks]);

  const projectsById = useMemo(() => 
    store.projects.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
    }, {} as Record<string, Project>), 
  [store.projects]);
  
  const findRootProject = useCallback((taskId: string): Project | null => {
    const visited = new Set<string>();
    let currentId: string | undefined = taskId;
    while(currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const task = tasksById[currentId];
        if (!task) return null;
        if (task.projectId) return projectsById[task.projectId] || null;
        currentId = task.parentTaskId || undefined;
    }
    return null;
  }, [tasksById, projectsById]);

  // Source of truth: prioritized order filtered by "in progress root" and "not completed"
  const filteredPrioritized = useMemo(() => {
    return store.prioritizedTaskIds.filter(id => {
      const t = tasksById[id];
      if (!t || t.completed) return false;
      const root = findRootProject(id);
      return root?.status === ProjectStatus.InProgress;
    });
  }, [store.prioritizedTaskIds, tasksById, findRootProject]);

  const handleWheelCore = (clientX: number, clientY: number, deltaY: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    const zoomFactor = 0.001;
    const newZoom = Math.max(0.2, Math.min(2, zoom - deltaY * zoomFactor));
    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleMouseDown = (e: ReactMouseEvent) => {
    if (e.target === e.currentTarget) {
        if (creationMenuPos) {
          setCreationMenuPos(null);
        }
        setIsPanning(true);
        setStartPoint({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        if(canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: ReactMouseEvent) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (canvasRect) {
      setMouseClientPos({ x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top });
      const newMousePos = {
        x: (e.clientX - canvasRect.left - pan.x) / zoom,
        y: (e.clientY - canvasRect.top - pan.y) / zoom
      };
      setMouseCanvasPos(newMousePos);
    } else {
      setMouseClientPos({ x: e.clientX, y: e.clientY });
    }

    if (!isPanning) return;
    setPan({
      x: e.clientX - startPoint.x,
      y: e.clientY - startPoint.y,
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
    if(canvasRef.current) canvasRef.current.style.cursor = 'grab';
  };
  
  const handleTouchStart = (e: ReactTouchEvent) => {
    if (e.target === e.currentTarget && e.touches.length === 1) {
        if (creationMenuPos) {
          setCreationMenuPos(null);
        }
        setIsPanning(true);
        setStartPoint({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  };

  const handleTouchMoveReact = (e: ReactTouchEvent) => {
    if (!isPanning || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - startPoint.x,
      y: e.touches[0].clientY - startPoint.y,
    });
  };

  const handleTouchEnd = () => {
      setIsPanning(false);
  };

  // Attach non-passive listeners to allow preventDefault safely
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // prevent page scroll while zooming canvas
      e.preventDefault();
      handleWheelCore(e.clientX, e.clientY, e.deltaY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isPanning || e.touches.length !== 1) return;
      // prevent page scroll while panning on touch
      e.preventDefault();
      const t = e.touches[0];
      setPan({
        x: t.clientX - startPoint.x,
        y: t.clientY - startPoint.y,
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [isPanning, startPoint, pan, zoom]);

  const handleDoubleClick = (e: ReactMouseEvent) => {
     if (e.target === e.currentTarget) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if(rect) {
            const canvasX = (e.clientX - rect.left - pan.x) / zoom;
            const canvasY = (e.clientY - rect.top - pan.y) / zoom;
            setCreationMenuPos({ canvasX, canvasY, clientX: e.clientX - rect.left, clientY: e.clientY - rect.top });
        }
    }
  };
  
  const navigateFromMiniMap = (contentX: number, contentY: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const newPanX = rect.width / 2 - contentX * zoom;
    const newPanY = rect.height / 2 - contentY * zoom;
    setPan({ x: newPanX, y: newPanY });
  };

  const handleCreateProject = () => {
    if (!creationMenuPos) return;
    setNewProjectPos({ x: creationMenuPos.canvasX, y: creationMenuPos.canvasY });
    setIsModalOpen(true);
    setCreationMenuPos(null);
  };

  const handleCreateTask = () => {
      if (!creationMenuPos) return;
      setNewTaskPos({ x: creationMenuPos.canvasX, y: creationMenuPos.canvasY });
      setTaskModalOpen(true);
      setCreationMenuPos(null);
  };
  
  const handleSaveNewTask = (taskData: Partial<Task>) => {
    if(newTaskPos) {
        store.addTask({
          title: taskData.title || '새 작업',
          content: taskData.content || '',
          date: taskData.date,
          endDate: taskData.endDate,
          file: taskData.file,
          fileURL: taskData.fileURL,
          position: newTaskPos,
          projectId: null,
        });
    }
  };


  const handleLineClick = (e: ReactMouseEvent, projectId: string, taskId: string) => {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setEditingLine({
        projectId,
        taskId,
        pos: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      });
    }
  };
  
  const handleProjectClick = (id: string, e: React.MouseEvent) => {
    setViewingNode({ type: 'project', id, pos: null });
  };
  const handleTaskClick = (id: string, e: React.MouseEvent) => {
    setViewingNode({ type: 'task', id, pos: null });
  };

  if (store.projects.length === 0 && store.tasks.length === 0) {
    return (
        <div className="relative w-full h-[calc(100vh-140px)] flex flex-col justify-center items-center text-center p-8 bg-primary rounded-lg border border-border-color shadow-inner">
            <div className="max-w-md">
                <ProjectsIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-text-main mb-2">캔버스가 비어 있습니다</h2>
                <p className="text-text-secondary mb-6">첫 번째 프로젝트를 만들어 작업을 시작해 보세요. 캔버스를 더블클릭하여 시작할 수 있습니다.</p>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center mx-auto space-x-2 bg-accent hover:bg-accent-hover text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg shadow-accent/20"
                >
                    <PlusIcon />
                    <span>새 프로젝트 만들기</span>
                </button>
            </div>
             <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setNewProjectPos(null); }} title="새 프로젝트 만들기">
                <ProjectForm 
                    store={store} 
                    onClose={() => { setIsModalOpen(false); setNewProjectPos(null); }} 
                    newProjectPosition={newProjectPos || undefined}
                />
            </Modal>
        </div>
    )
  }

  return (
    <div className="relative w-full h-[calc(100vh-140px)] overflow-hidden bg-primary rounded-lg border border-border-color shadow-inner">
      {hoveredNode && (
        <div 
            className="absolute z-50 bg-secondary rounded-md shadow-lg p-3 border border-border-color text-sm max-w-xs"
            style={{ 
                left: mouseClientPos.x, 
                top: mouseClientPos.y,
                transform: 'translate(10px, 10px)',
                pointerEvents: 'none'
            }}
        >
            <h4 className="font-bold text-text-main">{hoveredNode.data.title}</h4>
            {hoveredNode.data.content && <p className="text-text-secondary mt-1">{hoveredNode.data.content}</p>}
        </div>
       )}

      {creationMenuPos && (
        <div
          className="absolute z-20 flex flex-row gap-3"
          style={{ left: creationMenuPos.clientX, top: creationMenuPos.clientY, transform: 'translate(-50%, -50%)' }}
        >
          <button
            onClick={handleCreateProject}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-secondary hover:bg-accent text-text-main hover:text-white transition-all shadow-lg shadow-accent/20"
            title="프로젝트 만들기"
          >
            <ProjectsIcon className="w-6 h-6"/>
          </button>
          <button
            onClick={handleCreateTask}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-secondary hover:bg-primary border border-border-color text-text-main transition-all shadow-lg"
            title="새 작업"
          >
            <EditIcon className="w-6 h-6"/>
          </button>
        </div>
      )}

      <div
        ref={canvasRef}
        className="w-full h-full cursor-grab bg-dots"
        // wheel & touchmove listeners are attached with passive:false via useEffect
        style={{ touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMoveReact}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onContextMenu={(e) => {
          // Cancel linking with right-click (context menu)
          if (linkingTaskId) {
            e.preventDefault();
            setLinkingTaskId(null);
          }
        }}
      >
        <div
          className="relative"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
        >
          <svg className="absolute top-0 left-0" style={{ width: '400vw', height: '400vh', overflow: 'visible', pointerEvents: 'none' }}>
             {linkingTaskId && store.tasks.find(t => t.id === linkingTaskId) && (
              <line
                x1={store.tasks.find(t => t.id === linkingTaskId)!.position.x}
                y1={store.tasks.find(t => t.id === linkingTaskId)!.position.y}
                x2={mouseCanvasPos.x}
                y2={mouseCanvasPos.y}
                stroke="var(--color-accent)"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
            )}
            {store.projects.map(project => {
              const tasksForProject = store.tasks.filter(t => t.projectId === project.id);
              return tasksForProject.map(task => {
                // compute preview-aware positions
                const pOffset = project.id === draggedProjectId ? groupPreviewOffset : { x: 0, y: 0 };
                const tOffset =
                  (draggedProjectId && project.id === draggedProjectId) ? groupPreviewOffset :
                  (taskPreview.id === task.id ? taskPreview.offset : { x: 0, y: 0 });
                const p1 = { x: project.position.x + pOffset.x, y: project.position.y + pOffset.y };
                const p2 = { x: task.position.x + tOffset.x, y: task.position.y + tOffset.y };
                const pathData = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;

                return (
                  <g key={`line-group-proj-${project.id}-${task.id}`}>
                      <path
                        d={pathData}
                        stroke="transparent"
                        strokeWidth="20"
                        fill="none"
                        style={{ pointerEvents: 'stroke' }}
                        onClick={(e) => handleLineClick(e, project.id, task.id)}
                      />
                      <path
                        d={pathData}
                        stroke={task.lineStyle?.color || 'var(--color-border-color)'}
                        strokeWidth={task.lineStyle?.strokeWidth || 2}
                        fill="none"
                        style={{
                            pointerEvents: 'none',
                            transition: 'opacity 0.5s ease-in-out',
                            opacity: project.isCollapsed ? 0 : 0.7
                        }}
                      />
                  </g>
                )
              });
            })}
            {store.tasks.filter(t => t.parentTaskId).map(task => {
                const parentTask = tasksById[task.parentTaskId!];
                if (!parentTask) return null;
                
                const rootProject = findRootProject(task.id);
                const isCollapsed = !!rootProject?.isCollapsed;

                // preview-aware offsets
                const rootId = rootProject?.id;
                const pOffset =
                  (draggedProjectId && rootId === draggedProjectId) ? groupPreviewOffset :
                  (taskPreview.id === parentTask.id ? taskPreview.offset : { x: 0, y: 0 });
                const cOffset =
                  (draggedProjectId && rootId === draggedProjectId) ? groupPreviewOffset :
                  (taskPreview.id === task.id ? taskPreview.offset : { x: 0, y: 0 });

                const p1 = { x: parentTask.position.x + pOffset.x, y: parentTask.position.y + pOffset.y };
                const p2 = { x: task.position.x + cOffset.x, y: task.position.y + cOffset.y };
                const pathData = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;

                return (
                    <g key={`line-group-task-${parentTask.id}-${task.id}`}>
                        <path
                            d={pathData}
                            stroke={'var(--color-border-color)'}
                            strokeWidth={2}
                            fill="none"
                            style={{
                                pointerEvents: 'none',
                                transition: 'opacity 0.5s ease-in-out',
                                opacity: isCollapsed ? 0 : 0.7
                            }}
                        />
                    </g>
                )
            })}
          </svg>

          {store.projects.map(project => (
            <ProjectNode 
              key={project.id} 
              project={project} 
              store={store} 
              zoom={zoom} 
              linkingTaskId={linkingTaskId} 
              setLinkingTaskId={setLinkingTaskId} 
              setHoveredNode={setHoveredNode} 
              onNodeClick={handleProjectClick} 
              onGroupDragStart={(id) => { setDraggedProjectId(id); setGroupPreviewOffset({ x: 0, y: 0 }); }}
              onGroupDragStop={() => { setDraggedProjectId(null); setGroupPreviewOffset({ x: 0, y: 0 }); }}
              onGroupPreview={(off) => setGroupPreviewOffset(off)}
            />
          ))}
          {store.tasks.map(task => {
              const parentProject = findRootProject(task.id);
              const isGroupDragging = !!parentProject && parentProject.id === draggedProjectId;
              const priorityIndex = filteredPrioritized.indexOf(task.id);
              const priority = priorityIndex > -1 ? priorityIndex + 1 : undefined;

              return (
                <TaskNode 
                  key={task.id} 
                  task={task} 
                  store={store} 
                  zoom={zoom} 
                  linkingTaskId={linkingTaskId} 
                  setLinkingTaskId={setLinkingTaskId} 
                  setHoveredNode={setHoveredNode} 
                  onNodeClick={handleTaskClick} 
                  parentProject={parentProject}
                  isGroupDragging={isGroupDragging}
                  groupOffset={isGroupDragging ? groupPreviewOffset : undefined}
                  onTaskPreview={(id, off) => setTaskPreview({ id, offset: off })}
                  priority={priority}
                />
              )
          })}

        </div>
        {editingLine && (() => {
            const task = store.tasks.find(t => t.id === editingLine.taskId);
            return task ? (
              <LineStyleEditor
                isOpen={!!editingLine}
                onClose={() => setEditingLine(null)}
                lineStyle={task.lineStyle}
                onSave={(style) => {
                  store.updateLineStyle(editingLine.projectId, editingLine.taskId, style);
                  setEditingLine(null);
                }}
                onDelete={() => {
                  store.unlinkTask(editingLine.projectId, editingLine.taskId);
                  setEditingLine(null);
                }}
                position={editingLine.pos}
              />
            ) : null;
          })()
        }
      </div>

      {/* MiniMap overlay */}
      <div className="absolute bottom-3 right-3 z-40">
        <MiniMap
          projects={store.projects}
          tasks={store.tasks}
          pan={pan}
          zoom={zoom}
          canvasSize={canvasSize}
          onNavigateTo={navigateFromMiniMap}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setNewProjectPos(null); }} title="새 프로젝트 만들기">
        <ProjectForm 
            store={store} 
            onClose={() => { setIsModalOpen(false); setNewProjectPos(null); }}
            newProjectPosition={newProjectPos || undefined}
        />
      </Modal>

      <Modal isOpen={isTaskModalOpen} onClose={() => { setTaskModalOpen(false); setNewTaskPos(null); }} title="새 작업 추가">
        <TaskForm 
            onSave={handleSaveNewTask}
            onClose={() => { setTaskModalOpen(false); setNewTaskPos(null); }}
        />
      </Modal>

      {(() => {
          // Viewing Modal
          if (viewingNode) {
              if (viewingNode.type === 'project') {
                  const projectToView = store.projects.find(p => p.id === viewingNode.id);
                  if (!projectToView) return null;
                  return (
                      <Modal
                        isOpen={true}
                        onClose={() => setViewingNode(null)}
                        title={projectToView.title}
                        position={viewingNode.pos}
                        titleRight={projectToView.status === ProjectStatus.Completed ? (
                          <button
                            onClick={() => {
                              store.deleteProject(projectToView.id);
                              setViewingNode(null);
                            }}
                            className="p-1 text-red-600 hover:bg-red-50 rounded-md border border-red-200"
                            title="프로젝트 삭제"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        ) : undefined}
                      >
                          <ProjectView
                              project={projectToView}
                              onEdit={() => {
                                  setEditingNode(viewingNode);
                                  setViewingNode(null);
                              }}
                              onFinish={() => store.finishProject(projectToView.id)}
                              onReactivate={() => store.reactivateProject(projectToView.id)}
                              onAutoLayout={() => store.autoArrangeProjectTasks(projectToView.id)}
                              onClose={() => setViewingNode(null)}
                          />
                      </Modal>
                  );
              }
              if (viewingNode.type === 'task') {
                  const taskToView = store.tasks.find(t => t.id === viewingNode.id);
                  if (!taskToView) return null;
                  return (
                      <Modal isOpen={true} onClose={() => setViewingNode(null)} title={taskToView.title} position={viewingNode.pos}>
                          <TaskView
                              task={taskToView}
                              onEdit={() => {
                                  setEditingNode(viewingNode);
                                  setViewingNode(null);
                              }}
                              onDelete={() => {
                                  store.deleteTask(taskToView.id);
                                  setViewingNode(null);
                              }}
                              onComplete={() => {
                                  const now = new Date().toISOString();
                                  store.updateTask(taskToView.id, { completed: true, completionDate: now });
                                  setViewingNode(null);
                              }}
                              onUncomplete={() => {
                                  store.updateTask(taskToView.id, { completed: false, completionDate: null });
                                  setViewingNode(null);
                              }}
                          />
                      </Modal>
                  );
              }
          }

          // Editing Modal
          if (editingNode) {
              if (editingNode.type === 'project') {
                  const projectToEdit = store.projects.find(p => p.id === editingNode.id);
                  if (!projectToEdit) return null;
                  return (
                      <Modal isOpen={true} onClose={() => setEditingNode(null)} title="프로젝트 수정" position={editingNode.pos}>
                          <ProjectForm store={store} projectToEdit={projectToEdit} onClose={() => setEditingNode(null)} />
                      </Modal>
                  );
              }
              if (editingNode.type === 'task') {
                  const taskToEdit = store.tasks.find(t => t.id === editingNode.id);
                  if (!taskToEdit) return null;
                  return (
                      <Modal isOpen={true} onClose={() => setEditingNode(null)} title="작업 수정" position={editingNode.pos}>
                          <TaskForm
                              onSave={(formData) => store.updateTask(taskToEdit.id, formData)}
                              onDelete={() => store.deleteTask(taskToEdit.id)}
                              taskToEdit={taskToEdit}
                              onClose={() => setEditingNode(null)}
                          />
                      </Modal>
                  );
              }
          }
          return null;
      })()}

      <style>{`
        .bg-dots {
            background-color: var(--color-primary);
            background-image: radial-gradient(circle, var(--color-border-color) 1px, rgba(0,0,0,0) 1px);
            background-size: 25px 25px;
        }
      `}</style>
    </div>
  );
};