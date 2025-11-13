import React, { useState, useCallback, useEffect } from 'react';
import { Project, Task, ProjectStatus } from '../types';
import { ProjectStore } from '../hooks/useProjectStore';
import { CheckIcon, AttachmentIcon, ChevronDownIcon, ChevronUpIcon } from './icons';

type HoveredNode = { type: 'project' | 'task', data: Project | Task };

const formatDateDisplay = (startDate?: string, endDate?: string): string | null => {
  if (!startDate) return null;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null; // Invalid date
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    } catch (e) {
      return null;
    }
  };

  const formattedStartDate = formatDate(startDate);
  if (!formattedStartDate) return null;

  if (endDate) {
    const formattedEndDate = formatDate(endDate);
    if (formattedEndDate) {
      return `${formattedStartDate} ~ ${formattedEndDate}`;
    }
  }
  
  return formattedStartDate;
};

const formatDateTimeDisplay = (dateStr?: string): string | null => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString('ko-KR', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(/\s/g, '');
  } catch (e) {
    return null;
  }
};


const DraggableNode: React.FC<{
  position: { x: number; y: number };
  onDrag: (pos: { dx: number; dy: number }) => void;
  onDragStart?: () => void;
  onDragStop: () => void;
  isGroupDragging?: boolean;
  zoom: number;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  externalOffset?: { x: number; y: number };
  onDragPreview?: (offset: { x: number; y: number }) => void;
}> = ({ position, onDrag, onDragStart, onDragStop, isGroupDragging, zoom, children, className, onClick, onMouseEnter, onMouseLeave, externalOffset, onDragPreview }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [lastPos, setLastPos] = useState(position);
    const [bodyUserSelectBackup, setBodyUserSelectBackup] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const dragStartRef = React.useRef<{ x: number; y: number } | null>(null);
    
    // Track click vs drag
    const [isClick, setIsClick] = useState(true);
    const [mouseDownEvent, setMouseDownEvent] = useState<React.MouseEvent | null>(null);
    const dragThreshold = 5;

    const handleMouseDown = (e: React.MouseEvent) => {
        onDragStart?.();
        setIsDragging(true);
        const start = { x: e.clientX / zoom, y: e.clientY / zoom };
        dragStartRef.current = start;
        setLastPos(start);
        setIsClick(true);
        setMouseDownEvent(e);
        e.stopPropagation();
        // Prevent text selection during drag for smoother UX
        setBodyUserSelectBackup(document.body.style.userSelect || '');
        document.body.style.userSelect = 'none';
        e.preventDefault();
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;
        const currentPos = { x: e.clientX / zoom, y: e.clientY / zoom };
        const start = dragStartRef.current || currentPos;
        const delta = { dx: currentPos.x - start.x, dy: currentPos.y - start.y };

        if (isClick && (Math.abs(delta.dx) > dragThreshold || Math.abs(delta.dy) > dragThreshold)) {
          setIsClick(false);
        }

        // Preview only: offset from drag start
        const preview = { x: delta.dx, y: delta.dy };
        setDragOffset(preview);
        onDragPreview?.(preview);
        setLastPos(currentPos);

    }, [isDragging, lastPos, onDrag, zoom, isClick, onDragPreview]);

    const handleMouseUp = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            // Commit final movement in one update
            if (dragOffset.x !== 0 || dragOffset.y !== 0) {
              onDrag({ dx: dragOffset.x, dy: dragOffset.y });
            }
            setDragOffset({ x: 0, y: 0 });
            onDragPreview?.({ x: 0, y: 0 });
            onDragStop();
            if(isClick && onClick && mouseDownEvent) {
                onClick(mouseDownEvent);
            }
        }
        // Restore user-select after drag ends
        if (bodyUserSelectBackup !== null) {
            document.body.style.userSelect = bodyUserSelectBackup;
        } else {
            document.body.style.removeProperty('user-select');
        }
    }, [isDragging, onDragStop, isClick, onClick, mouseDownEvent, dragOffset, onDrag]);
    
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const dynamicClasses = isDragging
        ? 'cursor-grabbing shadow-2xl z-10'
        : isGroupDragging
            ? ''
            : '';

    return (
        <div
            className={`absolute p-3 rounded-lg shadow-xl cursor-grab ${dynamicClasses} ${className}`}
            style={{
              left: position.x,
              top: position.y,
              transform: `translate(-50%, -50%) translate(${(dragOffset.x + (externalOffset?.x || 0))}px, ${(dragOffset.y + (externalOffset?.y || 0))}px) translateZ(0)`,
              willChange: isDragging ? 'transform' as any : undefined,
              userSelect: 'none'
            }}
            onMouseDown={handleMouseDown}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {children}
        </div>
    );
};

export const TaskNode: React.FC<{
  task: Task;
  store: ProjectStore;
  zoom: number;
  linkingTaskId: string | null;
  setLinkingTaskId: (id: string | null) => void;
  setHoveredNode: (node: HoveredNode | null) => void;
  onNodeClick: (id: string, e: React.MouseEvent) => void;
  parentProject: Project | null;
  isGroupDragging: boolean;
  priority?: number;
  groupOffset?: { x: number; y: number };
  onTaskPreview?: (taskId: string, offset: { x: number; y: number }) => void;
}> = ({ task, store, zoom, linkingTaskId, setLinkingTaskId, setHoveredNode, onNodeClick, parentProject, isGroupDragging, priority, groupOffset, onTaskPreview }) => {

    const handleDrag = (delta: { dx: number; dy: number }) => {
        const newPos = { x: task.position.x + delta.dx, y: task.position.y + delta.dy };
        store.updateTaskPosition(task.id, newPos);
    };

    const handleClick = (e: React.MouseEvent) => {
      if (linkingTaskId && linkingTaskId !== task.id) {
          store.linkTaskToTask(linkingTaskId, task.id);
          setLinkingTaskId(null);
      } 
      else if (task.projectId === null && !task.parentTaskId) { 
          setLinkingTaskId(task.id);
      } 
      else {
          onNodeClick(task.id, e);
      }
    };
    
    const isLinkingSource = linkingTaskId === task.id;
    const isProjectCompleted = parentProject?.status === ProjectStatus.Completed;
    const isProjectCollapsed = !!parentProject?.isCollapsed;
    const isCompleted = !!task.completed || isProjectCompleted;

    const displayPosition = isProjectCollapsed && parentProject ? parentProject.position : task.position;

    let bgClass = 'bg-secondary';
    let borderClass = 'border-border-color';
    let textClass = 'text-text-main';
    let secondaryTextClass = 'text-text-secondary';
    let dividerClass = 'border-border-color/50';

    if (!isLinkingSource && !isCompleted && priority === 1) {
        bgClass = 'bg-sky-200';
        borderClass = 'border-sky-300';
        textClass = 'text-sky-700';
        secondaryTextClass = 'text-sky-600';
        dividerClass = 'border-sky-700/20';
    } else if (isCompleted) {
        bgClass = 'bg-gray-200';
        borderClass = 'border-gray-300';
        textClass = 'text-text-secondary';
        secondaryTextClass = 'text-text-secondary';
    }

    if (isLinkingSource) {
        bgClass = 'bg-secondary';
        borderClass = 'border-accent border-2 animate-pulse';
        textClass = 'text-text-main';
        secondaryTextClass = 'text-text-secondary';
        dividerClass = 'border-border-color/50';
    }

    const nodeClassName = `border w-52 ${bgClass} ${borderClass} ${isProjectCollapsed ? 'opacity-0 pointer-events-none' : ''}`;
    const titleClassName = `font-semibold text-sm ${textClass}`;

    const dateDisplay = formatDateDisplay(task.date, task.endDate);
    const hasAttachment = !!task.file || !!task.fileURL;
    const completionDateDisplay = task.completionDate ? formatDateTimeDisplay(task.completionDate) : null;

    return (
        <DraggableNode
            position={displayPosition}
            onDrag={handleDrag}
            onDragStop={() => {}}
            isGroupDragging={isGroupDragging}
            zoom={zoom}
            externalOffset={isGroupDragging ? (groupOffset || { x: 0, y: 0 }) : undefined}
            onDragPreview={(off) => onTaskPreview?.(task.id, off)}
            className={nodeClassName}
            onClick={handleClick}
            onMouseEnter={() => setHoveredNode({type: 'task', data: task})}
            onMouseLeave={() => setHoveredNode(null)}
        >
            {hasAttachment && (
              <span className="absolute top-1 right-1 bg-white/80 rounded-full p-0.5 shadow">
                <AttachmentIcon className="w-3.5 h-3.5 text-text-secondary" />
              </span>
            )}
            {priority && !isCompleted && (
                <span className={`absolute -top-2 -right-2 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md z-10 ${priority === 1 ? 'bg-accent' : 'bg-gray-400'}`}>
                    {priority === 1 ? '★' : priority}
                </span>
            )}
            <div className="flex flex-col justify-between min-h-[3.5rem]">
                <p className={titleClassName}>{task.title}</p>
                
                {(dateDisplay || hasAttachment || (isCompleted && completionDateDisplay)) && (
                    <div className={`flex items-center text-xs ${secondaryTextClass} mt-2 pt-2 border-t ${dividerClass}`}>
                        {isCompleted && completionDateDisplay ? (
                             <span className="font-medium mr-auto text-green-600 flex items-center">
                                <CheckIcon className="w-3.5 h-3.5 mr-1" /> {completionDateDisplay}
                            </span>
                        ) : (
                            <span className="font-medium mr-auto">{dateDisplay}</span>
                        )}
                        {/* attachment icon moved to badge; avoid duplicate icon here */}
                    </div>
                )}
            </div>
        </DraggableNode>
    );
}


export const ProjectNode: React.FC<{
    project: Project;
    store: ProjectStore;
    zoom: number;
    linkingTaskId: string | null;
    setLinkingTaskId: (id: string | null) => void;
    setHoveredNode: (node: HoveredNode | null) => void;
    onNodeClick: (id: string, e: React.MouseEvent) => void;
    onGroupDragStart: (id: string) => void;
    onGroupDragStop: () => void;
    onGroupPreview?: (offset: { x: number; y: number }) => void;
}> = ({ project, store, zoom, linkingTaskId, setLinkingTaskId, setHoveredNode, onNodeClick, onGroupDragStart, onGroupDragStop, onGroupPreview }) => {
    
    const handleProjectDrag = (delta: { dx: number, dy: number }) => {
        store.moveProjectGroup(project.id, delta);
    };

    const handleClick = (e: React.MouseEvent) => {
        if (linkingTaskId) {
            store.linkTaskToProject(linkingTaskId, project.id);
            setLinkingTaskId(null);
        } else {
            onNodeClick(project.id, e);
        }
    };
    
    const isCompleted = project.status === ProjectStatus.Completed;
    const dateDisplay = formatDateDisplay(project.date, project.endDate);
    const hasAttachment = !!project.file || !!project.fileURL;

    return (
        <DraggableNode
            position={project.position}
            onDrag={handleProjectDrag}
            onDragStart={() => onGroupDragStart(project.id)}
            onDragStop={onGroupDragStop}
            onDragPreview={onGroupPreview}
            zoom={zoom}
            className={`group ${isCompleted ? 'bg-gray-200 border-gray-300' : 'bg-secondary border-accent'} border-2 w-64 min-h-[6rem]`}
            onClick={handleClick}
            onMouseEnter={() => setHoveredNode({type: 'project', data: project})}
            onMouseLeave={() => setHoveredNode(null)}
        >
            {hasAttachment && (
              <span className="absolute top-1 left-1 bg-white/80 rounded-full p-0.5 shadow">
                <AttachmentIcon className="w-3.5 h-3.5 text-text-secondary" />
              </span>
            )}
                <div className="flex flex-col justify-between h-full">
                <div>
                    <h3 className={`font-bold text-lg pr-2 ${isCompleted ? 'text-text-secondary' : 'text-text-main'}`}>{project.title}</h3>
                </div>

                {(dateDisplay || hasAttachment) && (
                    <div className="flex items-center text-xs text-text-secondary mt-2 pt-2 border-t border-border-color/50">
                        <span className="font-medium mr-auto">{dateDisplay}</span>
                        {/* attachment icon moved to badge; avoid duplicate icon here */}
                    </div>
                )}
            </div>
            {isCompleted && <CheckIcon className="w-6 h-6 text-success absolute -top-3 -right-3 bg-secondary rounded-full p-1 border border-gray-300" />}
            {isCompleted && (
                <button 
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        store.toggleProjectCollapse(project.id);
                    }}
                    className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-secondary hover:bg-primary rounded-full p-1 border border-gray-300 shadow-md transition-transform hover:scale-110"
                    title={project.isCollapsed ? '펼치기' : '접기'}
                >
                    {project.isCollapsed ? <ChevronDownIcon className="w-4 h-4 text-text-secondary"/> : <ChevronUpIcon className="w-4 h-4 text-text-secondary" />}
                </button>
            )}
        </DraggableNode>
    );
};