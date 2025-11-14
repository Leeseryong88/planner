import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { ProjectStore } from '../hooks/useProjectStore';
import { Modal } from './Modal';
import { DatePicker } from './DatePicker';
import { CalendarIcon } from './icons';

interface ProjectFormProps {
  onClose: () => void;
  store: ProjectStore;
  projectToEdit?: Project | null;
  newProjectPosition?: { x: number, y: number };
}

export const ProjectForm: React.FC<ProjectFormProps> = ({ onClose, store, projectToEdit, newProjectPosition }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isConfirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectToEdit) {
      setTitle(projectToEdit.title);
      setContent(projectToEdit.content || '');
      setDate(projectToEdit.date || '');
      setEndDate(projectToEdit.endDate || '');
    }
  }, [projectToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('프로젝트 제목을 입력해 주세요.');
      return;
    }
    // 신규 생성 시 기간 필수
    if (!projectToEdit) {
      if (!date || !endDate) {
        setError('기간은 필수입니다. 시작일과 종료일을 선택해 주세요.');
        return;
      }
    }

    const projectData = {
      title,
      content,
      date,
      endDate,
      // 파일은 Storage로 업로드되므로 객체만 전달,
      // fileURL은 업로드 후 store에서 갱신
      file: file || undefined,
      fileURL: file ? undefined : projectToEdit?.fileURL
    };

    if (projectToEdit) {
      store.updateProject(projectToEdit.id, projectData);
    } else {
      store.addProject(projectData, newProjectPosition);
    }
    onClose();
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleFinishProject = () => {
    if (projectToEdit) {
      store.finishProject(projectToEdit.id);
      setConfirmFinishOpen(false);
      onClose();
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-text-secondary mb-1">프로젝트 제목</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="프로젝트 제목을 입력하세요..."
            className="w-full bg-primary p-3 rounded-md border border-border-color focus:ring-2 focus:ring-accent-glow focus:border-accent transition-all"
          />
        </div>
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-text-secondary mb-1">내용 (선택 사항)</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="프로젝트에 대한 설명을 입력하세요..."
            className="w-full bg-primary p-3 rounded-md border border-border-color focus:ring-2 focus:ring-accent-glow focus:border-accent transition-all"
            rows={3}
          />
        </div>
        <div>
          <label htmlFor="date-range-picker" className="block text-sm font-medium text-text-secondary mb-1">
            기간 {projectToEdit ? <span className="text-text-secondary">(선택 사항)</span> : <span className="text-red-600 font-semibold">(필수)</span>}
          </label>
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex-1">
            <label htmlFor="file" className="block text-sm font-medium text-text-secondary mb-1">첨부 파일 (선택 사항)</label>
            <input
              type="file"
              id="file"
              onChange={handleFileChange}
              className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white hover:file:bg-accent-hover file:cursor-pointer transition-all"
            />
        </div>
        <div className="flex justify-between items-center pt-4">
            <div>
              {projectToEdit && (
                <button
                  type="button"
                  onClick={() => setConfirmFinishOpen(true)}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-all"
                >
                  프로젝트 종료
                </button>
              )}
            </div>
          <button type="submit" className="bg-accent hover:bg-accent-hover text-white font-bold py-2 px-6 rounded-lg transition-all shadow-lg shadow-accent/20">
            {projectToEdit ? '변경 사항 저장' : '프로젝트 만들기'}
          </button>
        </div>
      </form>

      {projectToEdit && (
         <Modal isOpen={isConfirmFinishOpen} onClose={() => setConfirmFinishOpen(false)} title="프로젝트 종료 확인">
            <div className="text-text-main">
                <p><span className="font-bold text-text-main">'{projectToEdit.title}'</span> 프로젝트를 정말로 종료하시겠습니까?</p>
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
      )}
    </>
  );
};