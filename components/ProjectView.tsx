import React, { useState } from 'react';
import { Project, ProjectStatus } from '../types';
import { EditIcon, CheckIcon, AttachmentIcon, CalendarIcon, RefreshIcon } from './icons';
import { Modal } from './Modal';

interface ProjectViewProps {
  project: Project;
  onEdit: () => void;
  onFinish: () => void;
  onReactivate: () => void;
  onClose: () => void;
  onAutoLayout?: () => void;
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

export const ProjectView: React.FC<ProjectViewProps> = ({ project, onEdit, onFinish, onReactivate, onClose, onAutoLayout }) => {
    const [isConfirmFinishOpen, setConfirmFinishOpen] = useState(false);

    const handleFinishProject = () => {
        onFinish();
        setConfirmFinishOpen(false);
        onClose(); // Close the main view modal too
    };
    
    const handleReactivateProject = () => {
        onReactivate();
        onClose();
    };

    const startDate = formatDate(project.date);
    const endDate = formatDate(project.endDate);
    const hasAttachment = !!project.fileURL || !!project.file;
    const fileName = (() => {
        if (project.fileName) return project.fileName;
        if (project.file && (project as any).file.name) return (project as any).file.name as string;
        if (project.fileURL) {
            try {
                const u = new URL(project.fileURL);
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
            <div className="space-y-4">
                <p className="text-text-secondary whitespace-pre-wrap">{project.content}</p>
                {onAutoLayout && (
                  <div className="flex justify-end">
                    <button
                      onClick={onAutoLayout}
                      className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary hover:bg-primary border border-border-color text-text-main font-semibold"
                      title="업무 노드 자동 정렬"
                    >
                      <RefreshIcon className="w-4 h-4" />
                      <span>자동 정렬</span>
                    </button>
                  </div>
                )}
                
                {(startDate || endDate) && (
                    <div className="flex items-center space-x-2 text-sm text-text-secondary p-3 bg-primary rounded-lg">
                        <CalendarIcon className="w-5 h-5" />
                        <span>
                            {startDate || '미지정'} ~ {endDate || '미지정'}
                        </span>
                    </div>
                )}

                {hasAttachment && project.fileURL && (
                  <div className="flex items-center text-sm p-3 bg-primary rounded-lg border border-border-color">
                    <AttachmentIcon className="w-5 h-5 mr-2 text-text-secondary" />
                    <a
                      href={project.fileURL}
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
                {project.status === ProjectStatus.Completed ? (
                    <button
                        onClick={handleReactivateProject}
                        className="flex items-center space-x-2 text-green-600 hover:bg-green-50 font-bold py-2 px-4 rounded-lg transition-all"
                    >
                        <RefreshIcon className="w-5 h-5"/>
                        <span>프로젝트 재활성</span>
                    </button>
                ) : (
                    <button
                        onClick={() => setConfirmFinishOpen(true)}
                        className="flex items-center space-x-2 text-red-600 hover:bg-red-50 font-bold py-2 px-4 rounded-lg transition-all"
                    >
                        <CheckIcon className="w-5 h-5"/>
                        <span>프로젝트 종료</span>
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

            <Modal isOpen={isConfirmFinishOpen} onClose={() => setConfirmFinishOpen(false)} title="프로젝트 종료 확인">
                <div className="text-text-main">
                    <p><span className="font-bold text-text-main">'{project.title}'</span> 프로젝트를 정말로 종료하시겠습니까?</p>
                    <div className="flex justify-end space-x-4 mt-6">
                        <button onClick={() => setConfirmFinishOpen(false)} className="bg-primary hover:bg-border-color text-text-main font-bold py-2 px-4 rounded-lg transition-all">
                            취소
                        </button>
                        <button onClick={handleFinishProject} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-all">
                            종료
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};