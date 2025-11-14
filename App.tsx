import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { CalendarView } from './components/CalendarView';
import { ProjectsView } from './components/ProjectsView';
import { NoteView } from './components/NoteView';
import { CalendarIcon, DashboardIcon, LogoIcon, ProjectsIcon, EditIcon } from './components/icons';
import { useProjectStore } from './hooks/useProjectStore';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';

type View = 'dashboard' | 'calendar' | 'projects' | 'priority' | 'memos';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [focusProjectId, setFocusProjectId] = useState<string | null>(null);
  const projectStore = useProjectStore();

  const handleNavigateToProject = (projectId: string) => {
    setFocusProjectId(projectId);
    setCurrentView('dashboard');
  };
  
  const renderView = () => {
    switch (currentView) {
      case 'calendar':
        return <CalendarView store={projectStore} />;
      case 'projects':
        return <ProjectsView store={projectStore} onProjectClick={handleNavigateToProject} fixedMode="projects" />;
      case 'priority':
        // 같은 화면이지만 상단 탭만 다른 이름으로 접근
        return <ProjectsView store={projectStore} onProjectClick={handleNavigateToProject} fixedMode="tasks" />;
      case 'memos':
        return <NoteView store={projectStore} />;
      case 'dashboard':
      default:
        return <Dashboard 
                  store={projectStore} 
                  focusProjectId={focusProjectId} 
                  onFocusHandled={() => setFocusProjectId(null)}
               />;
    }
  };

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
    <div className="min-h-screen bg-gradient-to-b from-primary to-primary-gradient-end font-sans">
      <header className="bg-secondary/30 backdrop-blur-lg sticky top-0 z-50 p-4 border-b border-border-color/50">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <LogoIcon className="w-7 h-7 text-accent"/>
            <button onClick={() => setCurrentView('dashboard')} className="text-left">
              <h1 className="text-xl md:text-2xl font-bold text-text-main tracking-wider">work-task 플래너</h1>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex items-center space-x-2 md:space-x-4 bg-primary/50 p-1 rounded-xl">
              <NavItem view="dashboard" label="캔버스" icon={<DashboardIcon />} />
              <NavItem view="projects" label="목록" icon={<ProjectsIcon />} />
              <NavItem view="priority" label="업무 우선순위" icon={<ProjectsIcon />} />
              <NavItem view="memos" label="NOTE" icon={<EditIcon />} />
              <NavItem view="calendar" label="캘린더" icon={<CalendarIcon />} />
            </nav>
            <button
              onClick={() => signOut(auth)}
              className="ml-2 px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800"
              title="로그아웃"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="p-4 md:p-8">
        {renderView()}
      </main>
    </div>
  );
};

export default App;