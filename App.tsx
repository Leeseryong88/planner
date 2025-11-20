import React, { Suspense, useMemo, useState } from 'react';
import { CalendarIcon, DashboardIcon, LogoIcon, ProjectsIcon, EditIcon, PriorityIcon, WeeklyIcon } from './components/icons';
import { useProjectStore } from './hooks/useProjectStore';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { useIsMobile } from './hooks/useIsMobile';

const DashboardView = React.lazy(() => import('./components/Dashboard').then(mod => ({ default: mod.Dashboard })));
const CalendarView = React.lazy(() => import('./components/CalendarView').then(mod => ({ default: mod.CalendarView })));
const ProjectsViewLazy = React.lazy(() => import('./components/ProjectsView').then(mod => ({ default: mod.ProjectsView })));
const NoteView = React.lazy(() => import('./components/NoteView').then(mod => ({ default: mod.NoteView })));
const WeeklyReviewView = React.lazy(() => import('./components/WeeklyReviewView').then(mod => ({ default: mod.WeeklyReviewView })));

type View = 'dashboard' | 'calendar' | 'projects' | 'priority' | 'memos' | 'weekly';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [focusProjectId, setFocusProjectId] = useState<string | null>(null);
  const projectStore = useProjectStore();
  const isMobile = useIsMobile();

  const handleNavigateToProject = (projectId: string) => {
    setFocusProjectId(projectId);
    setCurrentView('dashboard');
  };
  
  const renderView = () => {
    switch (currentView) {
      case 'calendar':
        return <CalendarView store={projectStore} />;
      case 'projects':
        return <ProjectsViewLazy store={projectStore} onProjectClick={handleNavigateToProject} fixedMode="projects" />;
      case 'priority':
        return <ProjectsViewLazy store={projectStore} onProjectClick={handleNavigateToProject} fixedMode="tasks" />;
      case 'memos':
        return <NoteView store={projectStore} />;
      case 'weekly':
        return <WeeklyReviewView store={projectStore} />;
      case 'dashboard':
      default:
        return (
          <DashboardView
            store={projectStore}
            focusProjectId={focusProjectId}
            onFocusHandled={() => setFocusProjectId(null)}
          />
        );
    }
  };

  const navConfig = useMemo(() => ([
    { view: 'dashboard' as View, label: '캔버스', icon: <DashboardIcon /> },
    { view: 'projects' as View, label: '목록', icon: <ProjectsIcon /> },
    { view: 'priority' as View, label: '우선순위', icon: <PriorityIcon /> },
    { view: 'memos' as View, label: 'NOTE', icon: <EditIcon /> },
    { view: 'weekly' as View, label: '주간업무', icon: <WeeklyIcon /> },
    { view: 'calendar' as View, label: '캘린더', icon: <CalendarIcon /> },
  ]), []);

  const NavItem = ({ view, label, icon }: { view: View; label: string; icon: React.ReactElement }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
        currentView === view ? 'bg-accent text-white shadow-lg' : 'hover:bg-gray-100 text-text-secondary'
      }`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary to-primary-gradient-end font-sans pb-20 md:pb-0">
      <header className="bg-secondary/40 backdrop-blur-lg sticky top-0 z-40 p-3 md:p-4 border-b border-border-color/50">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <LogoIcon className="w-7 h-7 text-accent"/>
            <button onClick={() => setCurrentView('dashboard')} className="text-left">
              <h1 className="text-lg md:text-2xl font-bold text-text-main tracking-wider">work-task 플래너</h1>
            </button>
          </div>
          {!isMobile && (
            <div className="flex items-center gap-2">
              <nav className="flex items-center space-x-2 md:space-x-3 bg-primary/50 p-1 rounded-xl">
                {navConfig.map(item => (
                  <NavItem key={item.view} {...item} />
                ))}
              </nav>
              <button
                onClick={() => signOut(auth)}
                className="ml-2 px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm"
                title="로그아웃"
              >
                로그아웃
              </button>
            </div>
          )}
          {isMobile && (
            <button
              onClick={() => signOut(auth)}
              className="px-3 py-1.5 rounded-lg bg-gray-900/70 text-white text-xs"
              title="로그아웃"
            >
              로그아웃
            </button>
          )}
        </div>
      </header>
      <main className="p-3 md:p-8">
        <Suspense fallback={<div className="flex justify-center items-center h-[calc(100vh-200px)] text-text-secondary">로딩 중...</div>}>
          {renderView()}
        </Suspense>
      </main>
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-secondary/80 backdrop-blur-md border-t border-border-color/70 z-50">
          <div className="flex justify-around py-2">
            {navConfig.map(item => (
              <button
                key={item.view}
                onClick={() => setCurrentView(item.view)}
                className={`flex flex-col items-center justify-center text-xs font-semibold transition-colors ${
                  currentView === item.view ? 'text-accent' : 'text-text-secondary'
                }`}
              >
                <div className={`p-2 rounded-full ${currentView === item.view ? 'bg-accent/20' : ''}`}>
                  {React.cloneElement(item.icon, { className: 'w-5 h-5' })}
                </div>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
};

export default App;