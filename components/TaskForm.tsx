import React, { useState, useEffect } from 'react';
import { Task } from '../types';
import { DatePicker } from './DatePicker';
import { CalendarIcon, ChevronUpIcon, ChevronDownIcon } from './icons';

// Fix: Redefine TaskFormData to only include fields the form is responsible for.
// The original type required `position` and `projectId`, which this form doesn't
// handle during creation, causing an error.
type TaskFormData = Omit<Task, 'id' | 'completed' | 'position' | 'projectId' | 'parentTaskId'>;


interface TaskFormProps {
  onClose: () => void;
  onSave: (taskData: Partial<Task>) => void;
  onDelete?: () => void;
  taskToEdit?: Task | null;
  // Priority controls (only used when editing)
  priorityIndex?: number | null;
  onPriorityAddToEnd?: () => void;
  onPriorityRemove?: () => void;
  onPriorityUp?: () => void;
  onPriorityDown?: () => void;
  onPriorityTop?: () => void;
  onPriorityBottom?: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ onClose, onSave, onDelete, taskToEdit, priorityIndex, onPriorityAddToEnd, onPriorityRemove, onPriorityUp, onPriorityDown, onPriorityTop, onPriorityBottom }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setContent(taskToEdit.content);
      setDate(taskToEdit.date || '');
      setEndDate(taskToEdit.endDate || '');
    }
  }, [taskToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Fix: Construct a data object that is compatible with what onSave expects.
    // The previous object was missing required fields for the original TaskFormData type.
    const taskData: Partial<Task> = {
      title,
      content,
      date,
      endDate,
      // 파일은 Storage로 업로드되므로 객체 자체만 전달하고,
      // fileURL은 스토리지 업로드 후 store가 업데이트합니다.
      file: file || undefined,
      fileURL: file ? undefined : taskToEdit?.fileURL
    };
    
    onSave(taskData);
    onClose();
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDelete = () => {
    if(onDelete) {
      onDelete();
    }
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-text-secondary mb-1">작업 제목</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="작업 제목을 입력하세요..."
          className="w-full bg-primary p-3 rounded-md border border-border-color focus:ring-2 focus:ring-accent-glow focus:border-accent transition-all"
        />
      </div>
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-text-secondary mb-1">내용 (선택 사항)</label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="작업 내용을 입력하세요..."
          className="w-full bg-primary p-3 rounded-md border border-border-color focus:ring-2 focus:ring-accent-glow focus:border-accent transition-all"
          rows={3}
        />
      </div>
      <div>
          <label htmlFor="date-range-picker" className="block text-sm font-medium text-text-secondary mb-1">기간 (선택 사항)</label>
          <div className="relative">
            <button
              type="button"
              id="date-range-picker"
              onClick={() => setIsDatePickerOpen(prev => !prev)}
              className="w-full flex items-center justify-between bg-primary p-3 rounded-md border border-border-color text-left focus:ring-2 focus:ring-accent-glow focus:border-accent transition-all"
            >
              <span className={date ? 'text-text-main' : 'text-text-secondary'}>
                {date && endDate ? `${date} ~ ${endDate}` : date ? date : '날짜를 선택하세요'}
              </span>
              <CalendarIcon className="w-5 h-5 text-text-secondary"/>
            </button>
            {isDatePickerOpen && (
              <DatePicker
                startDate={date || null}
                endDate={endDate || null}
                onDateChange={({ startDate, endDate }) => {
                  setDate(startDate || '');
                  setEndDate(endDate || '');
                }}
                onClose={() => setIsDatePickerOpen(false)}
              />
            )}
          </div>
        </div>
      <div className="flex-1">
          <label htmlFor="file" className="block text-sm font-medium text-text-secondary mb-1">첨부 파일 (선택 사항)</label>
          <input
            type="file"
            id="file"
            onChange={handleFileChange}
            className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white hover:file:bg-accent-hover file:cursor-pointer transition-all"
          />
        </div>
      {/* Priority controls when editing */}
      {taskToEdit && (
        <div className="mt-2 p-3 bg-primary rounded-lg border border-border-color">
          <div className="flex items-center justify-between">
            <p className="text-sm">
              {priorityIndex && priorityIndex > 0 ? (
                <span className="text-text-main">현재 우선순위: <span className="font-bold">{priorityIndex}</span></span>
              ) : (
                <span className="text-text-secondary">우선순위 미설정</span>
              )}
            </p>
            <div className="flex items-center gap-3">
              {priorityIndex && priorityIndex > 0 ? (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      title="위로"
                      onClick={onPriorityUp}
                      className="p-1.5 rounded-md border border-border-color hover:bg-gray-100 flex items-center justify-center"
                    >
                      <ChevronUpIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="아래로"
                      onClick={onPriorityDown}
                      className="mt-1 p-1.5 rounded-md border border-border-color hover:bg-gray-100 flex items-center justify-center"
                    >
                      <ChevronDownIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={onPriorityRemove}
                    className="px-2 py-1 text-xs rounded-md border border-red-300 text-red-600 hover:bg-red-50"
                  >
                    제거
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onPriorityAddToEnd}
                  className="px-3 py-1 text-xs rounded-md bg-accent text-white hover:bg-accent-hover"
                >
                  우선순위 추가
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center pt-4">
        <div>
          {taskToEdit && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-all"
            >
              작업 삭제
            </button>
          )}
        </div>
        <button type="submit" className="bg-accent hover:bg-accent-hover text-white font-bold py-2 px-6 rounded-lg transition-all shadow-lg shadow-accent/20">
          {taskToEdit ? '작업 저장' : '작업 추가'}
        </button>
      </div>
    </form>
  );
};