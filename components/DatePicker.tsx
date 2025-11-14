import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

interface DatePickerProps {
  startDate: string | null;
  endDate: string | null;
  onDateChange: (dates: { startDate: string | null, endDate: string | null }) => void;
  onClose: () => void;
}

// Use local timezone to avoid off-by-one (UTC) issues
const formatDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const parseDateString = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const DatePicker: React.FC<DatePickerProps> = ({ startDate, endDate, onDateChange, onClose }) => {
  const [currentMonthDate, setCurrentMonthDate] = useState(startDate ? parseDateString(startDate) : new Date());
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleDateClick = (day: Date) => {
    const dayStr = formatDateString(day);
    if (!startDate || (startDate && endDate)) {
      onDateChange({ startDate: dayStr, endDate: null });
    } else {
      const start = parseDateString(startDate);
      if (day < start) {
        onDateChange({ startDate: dayStr, endDate: startDate });
      } else {
        onDateChange({ startDate: startDate, endDate: dayStr });
      }
      onClose();
    }
  };
  
  const changeMonth = (offset: number) => {
    setCurrentMonthDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + offset);
      return newDate;
    });
  };

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const daysInMonth = [];
  const startDayOfWeek = firstDayOfMonth.getDay();
  for (let i = 0; i < startDayOfWeek; i++) {
    const date = new Date(firstDayOfMonth);
    date.setDate(date.getDate() - (startDayOfWeek - i));
    daysInMonth.push(date);
  }
  for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
    daysInMonth.push(new Date(year, month, i));
  }
  const remainingDays = 42 - daysInMonth.length;
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(lastDayOfMonth);
    date.setDate(date.getDate() + i);
    daysInMonth.push(date);
  }

  return (
    <div ref={pickerRef} className="absolute z-50 mt-2 bg-secondary rounded-lg shadow-2xl p-4 border border-border-color w-80 animate-fade-in-down">
      <div className="flex justify-between items-center mb-4">
        <button type="button" onClick={() => changeMonth(-1)} className="p-1 rounded-full hover:bg-gray-100"><ChevronLeftIcon /></button>
        <span className="font-bold text-text-main">
          {currentMonthDate.toLocaleString('ko-KR', { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" onClick={() => changeMonth(1)} className="p-1 rounded-full hover:bg-gray-100"><ChevronRightIcon /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-text-secondary mb-2">
        {['일', '월', '화', '수', '목', '금', '토'].map(day => <div key={day}>{day}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {daysInMonth.map((day, index) => {
          const sDate = startDate ? parseDateString(startDate) : null;
          const eDate = endDate ? parseDateString(endDate) : null;
          
          const isCurrentMonth = day.getMonth() === month;
          const now = new Date();
          const isToday = day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth() && day.getDate() === now.getDate();
          const isStartDate = sDate && day.getTime() === sDate.getTime();
          const isEndDate = eDate && day.getTime() === eDate.getTime();
          const isInRange = sDate && eDate && day > sDate && day < eDate;
          
          let isInHoverRange = false;
          if (sDate && !eDate && hoveredDate) {
            const start = sDate;
            const hover = hoveredDate;
            if (hover >= start) {
              isInHoverRange = day > start && day < hover;
            } else {
              isInHoverRange = day > hover && day < start;
            }
          }
          const isHoveredEdge = sDate && !eDate && hoveredDate && day.getTime() === hoveredDate.getTime();

          const dayClasses = `
            h-9 w-9 flex items-center justify-center rounded-full cursor-pointer transition-colors text-sm
            ${isCurrentMonth ? 'text-text-main' : 'text-text-secondary opacity-40'}
            ${(isInRange || isInHoverRange) && !isStartDate && !isEndDate ? 'bg-accent/20' : ''}
            ${!isStartDate && !isEndDate && !isInRange && !isInHoverRange && !isHoveredEdge ? 'hover:bg-gray-100' : ''}
            ${isStartDate || isEndDate || isHoveredEdge ? 'bg-accent text-white' : ''}
            ${isToday && !isStartDate && !isEndDate ? 'text-red-600 font-bold' : ''}
          `;

          return (
            <div key={index} className="flex justify-center items-center p-0.5">
              <div
                className={`w-full h-9 flex items-center justify-center 
                  ${(isInRange || isInHoverRange) ? 'bg-accent/20' : ''}
                  ${isStartDate && eDate && day.getTime() === sDate?.getTime() ? 'rounded-l-full' : ''}
                  ${isEndDate && day.getTime() === eDate?.getTime() ? 'rounded-r-full' : ''}
                  ${sDate && !eDate && isHoveredEdge && hoveredDate && day.getTime() > sDate.getTime() ? 'rounded-r-full':''}
                  ${sDate && !eDate && isHoveredEdge && hoveredDate && day.getTime() < sDate.getTime() ? 'rounded-l-full':''}
                  ${sDate && !eDate && day.getTime() === sDate.getTime() && hoveredDate && day.getTime() < hoveredDate.getTime() ? 'rounded-l-full':''}
                  ${sDate && !eDate && day.getTime() === sDate.getTime() && hoveredDate && day.getTime() > hoveredDate.getTime() ? 'rounded-r-full':''}
                `}
                onMouseEnter={() => setHoveredDate(day)}
                onMouseLeave={() => setHoveredDate(null)}
              >
                <button
                  type="button"
                  onClick={() => handleDateClick(day)}
                  className={dayClasses}
                >
                  {day.getDate()}
                </button>
              </div>
            </div>
          );
        })}
      </div>
       <style>{`
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-down { animation: fade-in-down 0.2s ease-out forwards; }
      `}</style>
    </div>
  );
};