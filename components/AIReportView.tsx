import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ProjectStore } from '../hooks/useProjectStore';
import { Project, Task, AIReport, ProjectStatus } from '../types';
import { DatePicker } from './DatePicker';
import { CalendarIcon, ChevronDownIcon, PlusIcon, TrashIcon } from './icons';
import { Modal } from './Modal';

const ProjectMultiSelect: React.FC<{
  projects: Project[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}> = ({ projects, selectedIds, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProjects = useMemo(() =>
    projects.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase())),
    [projects, searchTerm]
  );

  const handleToggle = (projectId: string) => {
    const newSelection = selectedIds.includes(projectId)
      ? selectedIds.filter(id => id !== projectId)
      : [...selectedIds, projectId];
    onChange(newSelection);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-primary p-3 rounded-md border border-border-color text-left focus:ring-2 focus:ring-accent-glow focus:border-accent transition-all"
      >
        <span className={selectedIds.length > 0 ? 'text-text-main' : 'text-text-secondary'}>
          {selectedIds.length > 0 ? `${selectedIds.length}개 프로젝트 선택됨` : '프로젝트 선택 (선택 사항)'}
        </span>
        <ChevronDownIcon className={`w-5 h-5 text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-secondary rounded-md shadow-lg border border-border-color max-h-60 overflow-y-auto">
          <div className="p-2">
            <input
              type="text"
              placeholder="프로젝트 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-primary p-2 rounded-md border border-border-color"
            />
          </div>
          <ul>
            {filteredProjects.map(p => (
              <li key={p.id} className="p-2 hover:bg-primary cursor-pointer" onClick={() => handleToggle(p.id)}>
                <label className="flex items-center space-x-2 w-full cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    readOnly
                    className="form-checkbox h-4 w-4 text-accent border-border-color rounded focus:ring-accent"
                  />
                  <span>{p.title}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const SimpleMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const htmlContent = useMemo(() => {
        let html = content
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^\s*[-*] (.*$)/gim, '<li>$1</li>');
        html = html.replace(/<\/li>\s*<li>/g, '</li><li>');
        html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
        html = html.replace(/\n/g, '<br />');
        html = html.replace(/<br \/>\s*<ul>/g, '<ul>');
        html = html.replace(/<\/ul>\s*<br \/>/g, '</ul>');
        html = html.replace(/<br \/>\s*<li>/g, '<li>');
        html = html.replace(/<\/li>\s*<br \/>/g, '</li>');
        return html;
    }, [content]);

    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};


export const AIReportView: React.FC<{ store: ProjectStore }> = ({ store }) => {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingReport, setViewingReport] = useState<AIReport | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const isValidForGeneration = useMemo(() => {
    return ((startDate && endDate) || selectedProjectIds.length > 0) && prompt.trim() !== '';
  }, [startDate, endDate, selectedProjectIds, prompt]);

  const handleGenerate = async () => {
    if (!isValidForGeneration) return;

    setIsLoading(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

      let sourceProjects: Project[] = [];
      if (selectedProjectIds.length > 0) {
        sourceProjects = store.projects.filter(p => selectedProjectIds.includes(p.id));
      }
      if (startDate && endDate) {
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd);
        const [ey, em, ed] = endDate.split('-').map(Number);
        const end = new Date(ey, em - 1, ed);

        const projectsByDate = store.projects.filter(p => {
            if (!p.date) return false;
            const [py, pm, pd] = p.date.split('-').map(Number);
            const pDate = new Date(py, pm - 1, pd);
            return pDate >= start && pDate <= end;
        });

        projectsByDate.forEach(pbd => {
          if (!sourceProjects.some(sp => sp.id === pbd.id)) {
            sourceProjects.push(pbd);
          }
        });
      }

      const tasksByProjectId = store.tasks.reduce((acc, task) => {
          const key = task.projectId || 'null';
          if(!acc[key]) acc[key] = [];
          acc[key].push(task);
          return acc;
      }, {} as Record<string, Task[]>);

      const formatProjectData = (project: Project): string => {
        const projectTasks = tasksByProjectId[project.id] || [];
        const tasksInfo = projectTasks.map(t => 
          `- ${t.title} (${t.completed ? '완료' : '진행중'})`
        ).join('\n');
        
        return `
프로젝트: ${project.title}
상태: ${project.status === ProjectStatus.InProgress ? '진행 중' : '완료'}
기간: ${project.date || '미정'} ~ ${project.endDate || '미정'}
설명: ${project.content || '없음'}
작업 목록:
${tasksInfo || '없음'}
        `.trim();
      };
      
      const dataString = sourceProjects.map(formatProjectData).join('\n\n---\n\n');

      const fullPrompt = `
You are a helpful project management assistant. Based on the following project and task data, please generate a report that fulfills the user's request.

Here is the data:
---
${dataString}
---

User's Request:
${prompt}

Please provide the report in clear, well-structured Korean markdown format. Use bold formatting sparingly, mainly for titles and key terms.
      `;
      
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: fullPrompt
      });
      const reportContent = response.text;
      
      const reportTitle = `AI 보고서: "${prompt.slice(0, 20)}..."`;

      store.addAIReport({
        title: reportTitle,
        content: reportContent,
        prompt,
        sourceProjectIds: sourceProjects.map(p => p.id),
        sourceDate: startDate && endDate ? `${startDate} to ${endDate}` : undefined,
        createdAt: new Date().toISOString(),
      });

      resetGenerator();

    } catch (err) {
      console.error("AI report generation failed:", err);
      setError('AI 보고서 생성에 실패했습니다. 나중에 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReport = (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    store.deleteAIReport(reportId);
  }

  const resetGenerator = () => {
    setIsGeneratorOpen(false);
    setStartDate(null);
    setEndDate(null);
    setSelectedProjectIds([]);
    setPrompt('');
    setError(null);
  }

  return (
    <div className="h-full flex flex-col">
      {!isGeneratorOpen && (
        <div className="mb-4">
          <button
            onClick={() => setIsGeneratorOpen(true)}
            className="flex items-center space-x-2 bg-accent hover:bg-accent-hover text-white font-bold py-2 px-4 rounded-lg transition-all shadow-lg shadow-accent/20"
          >
            <PlusIcon />
            <span>AI 보고서 생성하기</span>
          </button>
        </div>
      )}

      {isGeneratorOpen && (
        <div className="p-4 border border-border-color rounded-lg bg-secondary mb-6 space-y-4 animate-fade-in-down">
          <h3 className="text-lg font-bold">AI 보고서 생성</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-text-secondary mb-1">기간 선택 (프로젝트 시작일)</label>
              <button
                type="button"
                onClick={() => setIsDatePickerOpen(prev => !prev)}
                className="w-full flex items-center justify-between bg-primary p-3 rounded-md border border-border-color text-left"
              >
                <span className={startDate ? 'text-text-main' : 'text-text-secondary'}>
                  {startDate && endDate ? `${startDate} ~ ${endDate}` : startDate ? `${startDate} ~ ?` : '기간 선택 (선택 사항)'}
                </span>
                <CalendarIcon className="w-5 h-5 text-text-secondary"/>
              </button>
              {isDatePickerOpen && (
                <DatePicker
                  startDate={startDate}
                  endDate={endDate}
                  onDateChange={({ startDate, endDate }) => {
                    setStartDate(startDate);
                    setEndDate(endDate);
                  }}
                  onClose={() => setIsDatePickerOpen(false)}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">프로젝트 선택</label>
              <ProjectMultiSelect
                projects={store.projects}
                selectedIds={selectedProjectIds}
                onChange={setSelectedProjectIds}
              />
            </div>
          </div>
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-text-secondary mb-1">요청 내용</label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="예: '진행 중인 모든 프로젝트의 현재 상태를 요약하고, 가장 시급한 작업을 알려주세요.'"
              className="w-full bg-primary p-3 rounded-md border border-border-color focus:ring-2 focus:ring-accent-glow focus:border-accent transition-all"
              rows={3}
            />
             <p className="text-xs text-text-secondary mt-1">기간 또는 프로젝트 중 하나 이상을 반드시 선택해야 합니다.</p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={resetGenerator} className="bg-primary hover:bg-border-color text-text-main font-bold py-2 px-4 rounded-lg transition-all">
              취소
            </button>
            <button onClick={handleGenerate} disabled={!isValidForGeneration || isLoading} className="bg-accent hover:bg-accent-hover text-white font-bold py-2 px-4 rounded-lg transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center">
              {isLoading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
              {isLoading ? '생성 중...' : '생성하기'}
            </button>
          </div>
        </div>
      )}

      <div className="flex-grow overflow-y-auto">
        {store.aiReports.length === 0 && !isGeneratorOpen ? (
          <div className="text-center text-text-secondary py-10">
            <p>생성된 AI 보고서가 없습니다.</p>
            <p className="text-sm">'AI 보고서 생성하기'를 클릭하여 시작하세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {store.aiReports.map(report => (
              <div key={report.id} onClick={() => setViewingReport(report)} className="bg-secondary p-4 rounded-lg border border-border-color shadow-sm hover:shadow-md hover:border-accent transition-all cursor-pointer flex flex-col justify-between h-40">
                <div>
                  <h4 className="font-bold text-text-main truncate">{report.title}</h4>
                  <p className="text-xs text-text-secondary mt-1">
                    {new Date(report.createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <div className="flex justify-end">
                    <button onClick={(e) => handleDeleteReport(e, report.id)} className="p-1 text-text-secondary hover:text-red-500 rounded-full hover:bg-red-100"><TrashIcon className="w-4 h-4"/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingReport && (
        <Modal isOpen={true} onClose={() => setViewingReport(null)} title={viewingReport.title}>
            <div className="report-content bg-primary p-4 rounded-md max-h-[60vh] overflow-y-auto text-text-main">
                <h5 className="font-bold mb-2">요청 내용:</h5>
                <p className="text-sm italic text-text-secondary mb-4">{viewingReport.prompt}</p>
                <hr className="my-4 border-border-color"/>
                <SimpleMarkdownRenderer content={viewingReport.content} />
            </div>
        </Modal>
      )}
       <style>{`
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-down { animation: fade-in-down 0.2s ease-out forwards; }
        .report-content h1, .report-content h2, .report-content h3 { font-weight: 700; margin-top: 1em; margin-bottom: 0.5em; }
        .report-content h1 { font-size: 1.5rem; }
        .report-content h2 { font-size: 1.25rem; }
        .report-content h3 { font-size: 1.1rem; }
        .report-content ul { list-style-type: disc; padding-left: 1.5rem; margin-top: 0.5em; margin-bottom: 0.5em; }
        .report-content li { margin-bottom: 0.25em; }
        .report-content strong { font-weight: 700; }
        .report-content em { font-style: italic; }
        .report-content br {
            content: "";
            display: block;
            margin-bottom: 0.5em;
        }
      `}</style>
    </div>
  );
};