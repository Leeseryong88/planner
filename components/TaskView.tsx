import React from 'react';
import { Task } from '../types';
import { EditIcon, TrashIcon, AttachmentIcon, CalendarIcon, CheckIcon } from './icons';

interface TaskViewProps {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onComplete?: () => void;
  onUncomplete?: () => void;
}

const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
        return null;
    }
};

const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch (e) {
        return null;
    }
};

export const TaskView: React.FC<TaskViewProps> = ({ task, onEdit, onDelete, onComplete, onUncomplete }) => {
    const startDate = formatDate(task.date);
    const endDate = formatDate(task.endDate);
    const completionDate = formatDateTime(task.completionDate);
    const hasAttachment = !!task.fileURL || !!task.file;
    const fileName = (() => {
        if (task.fileName) return task.fileName;
        if (task.file && (task as any).file.name) return (task as any).file.name as string;
        if (task.fileURL) {
            try {
                const u = new URL(task.fileURL);
                const pathAfterO = u.pathname.split('/o/')[1]?.split('?')[0] || u.pathname;
                const decoded = decodeURIComponent(pathAfterO);
                const lastSeg = decoded.split('/').pop() || '';
                return lastSeg || '첨부 파일';
            } catch {
                return '첨부 파일';
            }
        }
        return null;
    })();

    return (
        <>
            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2 custom-scroll">
                <p className="text-text-secondary whitespace-pre-wrap">{task.content}</p>
                
                {task.completed && completionDate && (
                    <div className="flex items-center space-x-2 text-sm text-green-700 p-3 bg-green-50 rounded-lg">
                        <CheckIcon className="w-5 h-5" />
                        <span>
                            <strong>완료:</strong> {completionDate}
                        </span>
                    </div>
                )}

                {(startDate || endDate) && (
                    <div className={`flex items-center space-x-2 text-sm text-text-secondary p-3 bg-primary rounded-lg ${task.completed ? 'opacity-60' : ''}`}>
                        <CalendarIcon className="w-5 h-5" />
                        <span>
                            {startDate || '미지정'} ~ {endDate || '미지정'}
                        </span>
                    </div>
                )}

                {hasAttachment && task.fileURL && (
                  <div className="flex items-center text-sm p-3 bg-primary rounded-lg border border-border-color">
                    <AttachmentIcon className="w-5 h-5 mr-2 text-text-secondary" />
                    <a
                      href={task.fileURL}
                      download
                      className="text-text-main no-underline hover:opacity-80 truncate"
                      title="파일 다운로드"
                    >
                      {fileName}
                    </a>
                  </div>
                )}
            </div>
            
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-border-color">
                <button
                    onClick={onDelete}
                    className="flex items-center space-x-2 text-red-600 hover:bg-red-50 font-bold py-2 px-4 rounded-lg transition-all"
                >
                    <TrashIcon className="w-5 h-5"/>
                    <span>작업 삭제</span>
                </button>
                <div className="flex items-center gap-2">
                    {task.completed && onUncomplete && (
                        <button
                            onClick={onUncomplete}
                            className="flex items-center space-x-2 border border-gray-300 text-text-main hover:bg-gray-50 font-bold py-2 px-4 rounded-lg transition-all"
                            title="완료 상태를 취소"
                        >
                            <CheckIcon className="w-5 h-5"/>
                            <span>완료 취소</span>
                        </button>
                    )}
                    {!task.completed && onComplete && (
                        <button
                            onClick={onComplete}
                            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-all"
                            title="지금 완료로 표시"
                        >
                            <CheckIcon className="w-5 h-5"/>
                            <span>완료</span>
                        </button>
                    )}
                    <button
                        onClick={onEdit}
                        className="flex items-center space-x-2 bg-accent hover:bg-accent-hover text-white font-bold py-2 px-4 rounded-lg transition-all"
                    >
                        <EditIcon className="w-5 h-5"/>
                        <span>수정하기</span>
                    </button>
                </div>
            </div>
        </>
    );
};