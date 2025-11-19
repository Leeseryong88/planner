import React, { useMemo, useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { ProjectStore } from '../hooks/useProjectStore';
import { Project, Task, ProjectStatus } from '../types';
import { DatePicker } from './DatePicker';
import { CalendarIcon, PlusIcon, TrashIcon } from './icons';
import { Modal } from './Modal';

type WeeklySections = {
  done: string;
  next: string;
  issues: string;
};

const parseISODate = (value?: string | null) => {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if ([y, m, d].some(Number.isNaN)) return null;
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

const isDateInRange = (date: Date | null, start: Date, end: Date) => {
  if (!date) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
};

const intersectsRange = (startDate: Date | null, endDate: Date | null, rangeStart: Date, rangeEnd: Date) => {
  if (startDate && endDate) {
    return startDate.getTime() <= rangeEnd.getTime() && endDate.getTime() >= rangeStart.getTime();
  }
  if (startDate) return isDateInRange(startDate, rangeStart, rangeEnd);
  if (endDate) return isDateInRange(endDate, rangeStart, rangeEnd);
  return false;
};

const formatWeekTitle = (baseDateIso?: string | null) => {
  const date = baseDateIso ? parseISODate(baseDateIso) : new Date();
  const target = date ?? new Date();
  const month = target.getMonth() + 1;
  const week = Math.floor((target.getDate() - 1) / 7) + 1;
  return `${month}월 ${week}주차 보고서`;
};

const buildTaskTreeForProject = (projectId: string, allTasks: Task[]) => {
  const directTasks = allTasks.filter(task => task.projectId === projectId);
  const childrenMap = new Map<string, Task[]>();
  allTasks.forEach(task => {
    if (!task.parentTaskId) return;
    const siblings = childrenMap.get(task.parentTaskId) || [];
    siblings.push(task);
    childrenMap.set(task.parentTaskId, siblings);
  });

  const collected: Task[] = [];
  const queue = [...directTasks];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    collected.push(current);
    const children = childrenMap.get(current.id) || [];
    queue.push(...children);
  }

  return collected;
};

const formatProjectSummary = (project: Project, tasks: Task[]) => {
  const taskLines = tasks.length > 0
    ? tasks.map((task, index) => {
        const planned = `${task.date || '미정'} ~ ${task.endDate || '미정'}`;
        const completedAt = task.completed ? (task.completionDate || '완료 (날짜 미기록)') : '미완료';
        return `${index + 1}. ${task.title} — ${task.completed ? '완료' : '진행중'}
내용: ${task.content || '없음'}
예정일: ${planned}
완료일: ${completedAt}`;
      }).join('\n')
    : '1. 하위 작업 없음';

  return `
${project.title}
상태: ${project.status === ProjectStatus.Completed ? '완료' : '진행 중'}
기간: ${(project.date || '미정')} ~ ${(project.endDate || '미정')}
${taskLines}
`.trim();
};

const extractJson = (raw: string) => {
  const candidates = [
    raw,
    ...Array.from(raw.matchAll(/```(?:json)?([\s\S]*?)```/g)).map(match => match[1]),
  ];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.trim());
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, string>;
      }
    } catch {
      continue;
    }
  }
  throw new Error('AI 응답을 파싱할 수 없습니다.');
};

export const WeeklyReviewView: React.FC<{ store: ProjectStore }> = ({ store }) => {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState<string | null>(null);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectionsDraft, setSectionsDraft] = useState<WeeklySections | null>(null);
  const [reportTitle, setReportTitle] = useState('');
  const [viewingReport, setViewingReport] = useState<typeof store.weeklyReports[number] | null>(null);

  useEffect(() => {
    if (periodStart) {
      setReportTitle(formatWeekTitle(periodStart));
    }
  }, [periodStart]);

  const sortedReports = useMemo(
    () => store.weeklyReports.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [store.weeklyReports]
  );

  const resetGenerator = () => {
    setIsGeneratorOpen(false);
    setIsDatePickerOpen(false);
    setPeriodStart(null);
    setPeriodEnd(null);
    setSectionsDraft(null);
    setReportTitle('');
    setError(null);
    setIsLoading(false);
  };

  const buildDataset = (range: { start: Date; end: Date }) => {
    const summaries: string[] = [];
    store.projects.forEach(project => {
      const tasks = buildTaskTreeForProject(project.id, store.tasks);
      const filteredTasks = tasks.filter(task => {
        const datesToCheck = [
          parseISODate(task.date),
          parseISODate(task.endDate),
          parseISODate(task.completionDate),
        ];
        return datesToCheck.some(date => date && isDateInRange(date, range.start, range.end));
      });

      if (filteredTasks.length > 0) {
        summaries.push(formatProjectSummary(project, filteredTasks));
      }
    });
    return summaries;
  };

  const handleGenerate = async () => {
    if (!periodStart || !periodEnd) {
      setError('기간을 먼저 선택해주세요.');
      return;
    }
    const start = parseISODate(periodStart);
    const end = parseISODate(periodEnd);
    if (!start || !end) {
      setError('유효한 날짜를 선택해주세요.');
      return;
    }
    if (start > end) {
      setError('시작일은 종료일보다 앞서야 합니다.');
      return;
    }

    const weekRanges = (() => {
      const firstMonday = new Date(start);
      firstMonday.setDate(firstMonday.getDate() - ((firstMonday.getDay() + 6) % 7));
      const secondMonday = new Date(firstMonday);
      secondMonday.setDate(firstMonday.getDate() + 7);
      const firstWeekEnd = new Date(firstMonday);
      firstWeekEnd.setDate(firstMonday.getDate() + 6);
      const secondWeekEnd = new Date(secondMonday);
      secondWeekEnd.setDate(secondMonday.getDate() + 6);
      return {
        doneRange: { start: firstMonday, end: firstWeekEnd },
        nextRange: { start: secondMonday, end: secondWeekEnd },
      };
    })();

    const dataset = buildDataset({ start, end });
    if (dataset.length === 0) {
      setError('선택한 기간에 해당하는 데이터가 없습니다.');
      return;
    }

    const prompt = `
당신은 한국어로 주간 업무 보고서를 작성하는 도우미입니다.
기간: ${periodStart} ~ ${periodEnd}

분석 기간(월~일): ${start.toISOString().slice(0, 10)} ~ ${end.toISOString().slice(0, 10)}

아래는 기간 내 활동과 연관된 모든 프로젝트와 각 프로젝트에 속한 하위 작업 데이터입니다. 각 작업은 어떤 프로젝트에 속해 있는지, 예정/완료 정보가 있는지 여부에 상관없이 모두 포함되어 있습니다:
${dataset.join('\n\n---\n\n')}

다음 JSON 형식으로만 응답하세요(설명 금지, JSON 이외의 내용 금지):
{
  "doneThisWeek": "\\n- 이번 주 완료 업무 요약",
  "nextWeekPlan": "\\n- 다음 주 계획 요약",
  "issues": "\\n- 지원이 필요한 이슈 (없으면 '이슈 없음')"
}

규칙:
- 각 값은 불릿 리스트 문자열 또는 간단한 문단이어야 합니다.
- nextWeekPlan에는 예정된 작업과 마감 임박 업무를 우선적으로 적으세요.
- issues에는 다음 주 수행을 위해 필요한 지원이나 리스크를 명시하고, 없으면 반드시 '이슈 없음'이라고 적으세요.
`;

    setIsLoading(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const resolveResponseText = (res: any): string => {
        if (typeof res?.response?.text === 'function') return res.response.text();
        if (typeof res?.text === 'function') return res.text();
        if (typeof res?.text === 'string') return res.text;
        const candidates = res?.response?.candidates;
        if (Array.isArray(candidates)) {
          return candidates
            .flatMap((candidate: any) => candidate?.content?.parts ?? [])
            .map((part: any) => part?.text ?? '')
            .join('\n');
        }
        return '';
      };

      const textPayload = resolveResponseText(response).trim();
      if (!textPayload) {
        throw new Error('AI 응답이 비어 있습니다.');
      }

      const parsed = extractJson(textPayload);

      const done = (parsed.doneThisWeek || '').trim();
      const next = (parsed.nextWeekPlan || '').trim();
      const issues = (parsed.issues || '').trim() || '이슈 없음';

      setSectionsDraft({
        done: done || '• 작성된 내용이 없습니다. 직접 입력해주세요.',
        next: next || '• 작성된 내용이 없습니다. 직접 입력해주세요.',
        issues,
      });
      if (!reportTitle) {
        setReportTitle(formatWeekTitle(periodStart));
      }
    } catch (err) {
      console.error(err);
      setError('AI 생성 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    if (!sectionsDraft || !periodStart || !periodEnd) {
      setError('생성된 보고서를 확인 후 저장해주세요.');
      return;
    }
    const finalTitle = reportTitle.trim() || formatWeekTitle(periodStart);
    store.addWeeklyReport({
      title: finalTitle,
      periodStart,
      periodEnd,
      sections: sectionsDraft,
      createdAt: new Date().toISOString(),
    });
    resetGenerator();
  };

  const renderGenerator = () => (
    <div className="p-4 border border-border-color rounded-lg bg-secondary space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-text-main">주간 업무 보고서 생성</h3>
        <button
          onClick={resetGenerator}
          className="text-sm text-text-secondary hover:text-text-main"
        >
          닫기
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <label className="block text-sm font-medium text-text-secondary mb-1">기간 선택</label>
          <button
            type="button"
            onClick={() => setIsDatePickerOpen(prev => !prev)}
            className="w-full flex items-center justify-between bg-primary p-3 rounded-md border border-border-color text-left"
          >
            <span className={periodStart ? 'text-text-main' : 'text-text-secondary'}>
              {periodStart && periodEnd ? `${periodStart} ~ ${periodEnd}` : '기간을 선택해 주세요'}
            </span>
            <CalendarIcon className="w-5 h-5 text-text-secondary" />
          </button>
          {isDatePickerOpen && (
            <DatePicker
              startDate={periodStart}
              endDate={periodEnd}
              onDateChange={({ startDate, endDate }) => {
                setPeriodStart(startDate);
                setPeriodEnd(endDate);
              }}
              onClose={() => setIsDatePickerOpen(false)}
            />
          )}
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={handleGenerate}
          disabled={!periodStart || !periodEnd || isLoading}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-4 py-2 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading && (
            <svg className="animate-spin -ml-1 h-4 w-4 mr-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {isLoading ? '생성 중...' : 'AI로 작성'}
        </button>
      </div>
      {sectionsDraft && (
        <div className="space-y-4 border-t border-border-color pt-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">보고서 제목</label>
            <input
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full bg-primary p-3 rounded-md border border-border-color focus:ring-2 focus:ring-accent-glow"
              placeholder="예: 3월 2주차 보고서"
            />
          </div>
          {(['done', 'next', 'issues'] as Array<keyof WeeklySections>).map((key, idx) => {
            const labels = ['이번 주에 한 일', '다음 주에 할 일', '이슈'];
            return (
              <div key={key}>
                <label className="block text-sm font-medium text-text-secondary mb-1">{labels[idx]}</label>
                <textarea
                  value={sectionsDraft[key]}
                  onChange={(e) => setSectionsDraft(prev => prev ? ({ ...prev, [key]: e.target.value }) : prev)}
                  className="w-full bg-primary p-3 rounded-md border border-border-color min-h-[120px]"
                />
              </div>
            );
          })}
          <div className="flex justify-end gap-2">
            <button onClick={() => setSectionsDraft(null)} className="px-4 py-2 rounded-lg border border-border-color">
              초기화
            </button>
            <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-accent text-white font-semibold">
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-secondary/50 rounded-lg p-4 border border-border-color h-[calc(100vh-140px)] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-text-main">주간 업무 기록</h2>
        {!isGeneratorOpen && (
          <button
            onClick={() => setIsGeneratorOpen(true)}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-4 py-2 rounded-lg shadow-lg shadow-accent/20"
          >
            <PlusIcon />
            <span>보고서 만들기</span>
          </button>
        )}
      </div>

      {isGeneratorOpen && renderGenerator()}

      <div className="flex-grow overflow-y-auto">
        {sortedReports.length === 0 ? (
          <div className="text-center text-text-secondary py-10">
            <p>저장된 주간 보고서가 없습니다.</p>
            <p className="text-sm">오른쪽 상단의 ‘보고서 만들기’ 버튼을 눌러 시작해 보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedReports.map(report => (
              <div
                key={report.id}
                className="bg-secondary border border-border-color rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                onClick={() => setViewingReport(report)}
              >
                <div>
                  <h3 className="font-bold text-text-main truncate">{report.title}</h3>
                  <p className="text-xs text-text-secondary mt-1">{report.periodStart} ~ {report.periodEnd}</p>
                  <p className="text-xs text-text-secondary mt-1">
                    생성일: {new Date(report.createdAt).toLocaleString('ko-KR', { dateStyle: 'medium' })}
                  </p>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <span className="text-xs text-text-secondary line-clamp-2">
                    {report.sections.done.split('\n').slice(0, 2).join(' ')}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      store.deleteWeeklyReport(report.id);
                    }}
                    className="p-1 text-text-secondary hover:text-red-500 rounded-full hover:bg-red-100"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingReport && (
        <Modal
          isOpen={true}
          onClose={() => setViewingReport(null)}
          title={viewingReport.title}
        >
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <h4 className="font-semibold text-text-main">기간</h4>
              <p className="text-sm text-text-secondary">{viewingReport.periodStart} ~ {viewingReport.periodEnd}</p>
            </div>
            <div>
              <h4 className="font-semibold text-text-main">1. 이번 주에 한 일</h4>
              <p className="text-sm whitespace-pre-wrap text-text-secondary">{viewingReport.sections.done}</p>
            </div>
            <div>
              <h4 className="font-semibold text-text-main">2. 다음 주에 할 일</h4>
              <p className="text-sm whitespace-pre-wrap text-text-secondary">{viewingReport.sections.next}</p>
            </div>
            <div>
              <h4 className="font-semibold text-text-main">3. 이슈</h4>
              <p className="text-sm whitespace-pre-wrap text-text-secondary">{viewingReport.sections.issues}</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

