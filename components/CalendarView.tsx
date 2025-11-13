import React, { useState, useMemo } from 'react';
import { ProjectStore } from '../hooks/useProjectStore';
import { Task } from '../types';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';
import { Modal } from './Modal';
import { TaskForm } from './TaskForm';

interface CalendarViewProps {
  store: ProjectStore;
}

const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];

const parseDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
};

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  type: 'project' | 'task';
  projectTitle?: string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ store }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [moreDate, setMoreDate] = useState<string | null>(null);

  const { dates, weeks } = useMemo(() => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    const startDate = new Date(startOfMonth);
    startDate.setDate(startDate.getDate() - startOfMonth.getDay());
    
    const endDate = new Date(endOfMonth);
    endDate.setDate(endDate.getDate() + (6 - endOfMonth.getDay()));

    const dates = [];
    let currentDatePointer = new Date(startDate);
    while (currentDatePointer <= endDate) {
        dates.push(new Date(currentDatePointer));
        currentDatePointer.setDate(currentDatePointer.getDate() + 1);
    }
    const weeks = [];
    for(let i=0; i<dates.length; i+=7) {
        weeks.push(dates.slice(i, i+7));
    }
    return { dates, weeks };
  }, [currentDate]);
  
  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = [];

    // Add projects
    store.projects.forEach(p => {
        if (p.date) {
            events.push({
                id: p.id,
                title: p.title,
                date: p.date,
                endDate: p.endDate,
                type: 'project',
            });
        }
    });

    // Add tasks
    store.tasks.forEach(t => {
        if (t.date) {
            const project = store.projects.find(p => p.id === t.projectId);
            events.push({
                id: t.id,
                title: t.title,
                date: t.date,
                endDate: t.endDate,
                type: 'task',
                projectTitle: project?.title || "개별 작업",
            });
        }
    });

    return events;
  }, [store.projects, store.tasks]);


  const changeMonth = (offset: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + offset);
      return newDate;
    });
  };

  const handleTaskClick = (taskId: string) => {
    setEditingTaskId(taskId);
  };
  
  const calendarGrid = useMemo(() => (
    <div className="grid grid-cols-7 gap-2">
      {dates.map(date => {
        const dateKey = date.toISOString().split('T')[0];
        const isCurrentMonth = date.getMonth() === currentDate.getMonth();
        const isToday = new Date().toISOString().split('T')[0] === dateKey;
        return (
          <div 
            key={date.toISOString()}
            className={`h-36 bg-secondary/50 rounded-lg p-2 border border-border-color/50 flex flex-col transition-colors hover:bg-gray-100 relative overflow-hidden ${isCurrentMonth ? '' : 'opacity-40'}`}
          >
            <div className={`font-semibold ${isToday ? 'text-accent' : 'text-text-main'} text-right relative z-10`}>
              {date.getDate()}
            </div>
          </div>
        );
      })}
    </div>
  ), [dates, currentDate]);

  const eventElements = useMemo(() => {
    const elements: React.ReactElement[] = [];
    const MAX_PROJECT_LANES = 2; // 프로젝트 최대 표시 줄
    const MAX_TASK_LANES = 3;    // 작업 최대 표시 줄
    const CELL_HEADER_OFFSET_REM = 2.25; // 일자 숫자 영역 높이(이 값만큼 위쪽 여백 확보)
    const LANE_HEIGHT_REM = 1.2;
    const WEEK_ROW_REM = 9; // 각 주의 세로 높이 (h-36 = 9rem)
    const dayMore: Record<string, { count: number; events: CalendarEvent[] }> = {};
    weeks.forEach((week, weekIndex) => {
        const weekStart = week[0];
        const weekEnd = week[6];

        const eventsInWeek = calendarEvents.filter(e => {
            const eventStart = parseDate(e.date);
            const eventEnd = e.endDate ? parseDate(e.endDate) : eventStart;
            return eventStart <= weekEnd && eventEnd >= weekStart;
        }).sort((a,b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());

        const projectsInWeek = eventsInWeek.filter(e => e.type === 'project');
        const tasksInWeek = eventsInWeek.filter(e => e.type === 'task');

        const placeEvents = (list: CalendarEvent[], maxLanes: number, baseOffsetLanes: number) => {
          const lanes: Date[] = [];
          list.forEach(event => {
            const eventStart = parseDate(event.date);
            const eventEnd = event.endDate ? parseDate(event.endDate) : eventStart;
            
            let laneIndex = lanes.findIndex(laneEndDate => eventStart > laneEndDate);
            if (laneIndex === -1) laneIndex = lanes.length;
            lanes[laneIndex] = eventEnd;
            
            const effectiveStart = eventStart < weekStart ? weekStart : eventStart;
            const effectiveEnd = eventEnd > weekEnd ? weekEnd : eventEnd;

            const startDayIndex = effectiveStart.getDay();
            const duration = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24) + 1;

            const isProject = event.type === 'project';
            const barClass = isProject
              ? 'bg-gradient-to-r from-indigo-500 to-blue-500 cursor-default'
              : 'bg-gradient-to-r from-green-500 to-emerald-500 cursor-pointer';

            if (laneIndex >= maxLanes) {
              const moreKey = `${weekIndex}-${effectiveStart.toISOString().split('T')[0]}`;
              if (!dayMore[moreKey]) {
                dayMore[moreKey] = { count: 0, events: [] };
              }
              dayMore[moreKey].count += 1;
              dayMore[moreKey].events.push(event);
              return;
            }

            elements.push(
              <div
                key={`${event.id}-${weekIndex}`}
                onClick={!isProject ? () => handleTaskClick(event.id) : undefined}
                className={`absolute ${barClass} text-white text-xs font-bold px-2 py-1 rounded-md overflow-hidden whitespace-nowrap pointer-events-auto shadow-lg hover:scale-[1.02] hover:z-10 transition-transform`}
                style={{
                  top: `calc(${weekIndex * WEEK_ROW_REM}rem + ${CELL_HEADER_OFFSET_REM}rem + ${(baseOffsetLanes + laneIndex)} * ${LANE_HEIGHT_REM}rem)`,
                  left: `calc(${(100 / 7) * startDayIndex}% + 2px)`,
                  width: `calc(${(100/7) * duration}% - 4px)`,
                }}
                title={isProject ? event.title : `${event.projectTitle}: ${event.title}`}
              >
                {event.title}
              </div>
            );
          });
          return lanes.length;
        };

        const usedProjectLanes = placeEvents(projectsInWeek, MAX_PROJECT_LANES, 0);
        placeEvents(tasksInWeek, MAX_TASK_LANES, Math.min(usedProjectLanes, MAX_PROJECT_LANES));

        // 더보기 배지 렌더링
        for (let d = 0; d < 7; d++) {
          const dateStr = new Date(week[d]).toISOString().split('T')[0];
          const moreKey = `${weekIndex}-${dateStr}`;
          const moreInfo = dayMore[moreKey];
          if (moreInfo && moreInfo.count > 0) {
            elements.push(
              <button
                key={`more-${moreKey}`}
                onClick={() => setMoreDate(dateStr)}
                className="absolute bg-gray-200 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded-full pointer-events-auto hover:bg-gray-300"
                style={{
                  top: `calc(${weekIndex * WEEK_ROW_REM}rem + ${CELL_HEADER_OFFSET_REM + (Math.min(usedProjectLanes, MAX_PROJECT_LANES) + MAX_TASK_LANES) * LANE_HEIGHT_REM + 0.25}rem)`,
                  left: `calc(${(100 / 7) * d}% + 6px)`,
                }}
                title={`${moreInfo.count}개 더 보기`}
              >
                +{moreInfo.count} 더보기
              </button>
            );
          }
        }
    });
    return elements;
  }, [weeks, calendarEvents]);


  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-text-main">캘린더</h2>
        <div className="flex items-center space-x-4">
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-secondary"><ChevronLeftIcon /></button>
          <span className="text-xl font-semibold w-40 text-center">
            {currentDate.toLocaleString('ko-KR', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-secondary"><ChevronRightIcon /></button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-2">
         {daysOfWeek.map(day => (
          <div key={day} className="text-center font-bold text-text-secondary text-sm pb-2">{day}</div>
        ))}
      </div>
      <div className="relative">
        {calendarGrid}
        <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none z-0">
            {eventElements}
        </div>
      </div>
      
      {editingTaskId && (() => {
        const taskToEdit = store.tasks.find(t => t.id === editingTaskId);
        if (!taskToEdit) return null;
        return (
            <Modal isOpen={true} onClose={() => setEditingTaskId(null)} title="작업 수정">
                <TaskForm
                    onSave={(formData) => store.updateTask(taskToEdit.id, formData)}
                    onDelete={() => store.deleteTask(taskToEdit.id)}
                    taskToEdit={taskToEdit}
                    onClose={() => setEditingTaskId(null)}
                />
            </Modal>
        );
      })()}

      {moreDate && (() => {
        // 선택한 날짜에 해당하는 모든 이벤트 수집
        const eventsForDay = calendarEvents.filter(e => {
          const s = parseDate(e.date);
          const eEnd = e.endDate ? parseDate(e.endDate) : s;
          const d = parseDate(moreDate);
          return d >= s && d <= eEnd;
        }).sort((a,b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
        return (
          <Modal isOpen={true} onClose={() => setMoreDate(null)} title={`${moreDate} 일정`}>
            <div className="space-y-2">
              {eventsForDay.map(ev => {
                const isProject = ev.type === 'project';
                const badge = isProject
                  ? 'bg-blue-500'
                  : 'bg-green-500';
                return (
                  <div key={ev.id} className="flex items-center gap-2">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${badge}`} />
                    <span className="text-sm text-text-main">
                      {isProject ? ev.title : `${ev.projectTitle}: ${ev.title}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </Modal>
        );
      })()}

    </div>
  );
};