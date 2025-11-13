import React, { useState } from 'react';
import { ProjectStore } from '../hooks/useProjectStore';
import { MemoBoard } from './MemoBoard';
import { AIReportView } from './AIReportView';

type NoteTab = 'memo' | 'aiReport';

export const NoteView: React.FC<{ store: ProjectStore }> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<NoteTab>('memo');

  const renderContent = () => {
    switch (activeTab) {
      case 'aiReport':
        return <AIReportView store={store} />;
      case 'memo':
      default:
        return <MemoBoard store={store} />;
    }
  };

  return (
    <div className="bg-secondary/50 rounded-lg p-4 border border-border-color h-[calc(100vh-140px)] flex flex-col">
      <div className="flex justify-end mb-6">
        <div className="flex items-center gap-2 p-1 bg-primary rounded-lg shadow-sm">
          <button
            onClick={() => setActiveTab('memo')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              activeTab === 'memo' ? 'bg-accent text-white shadow' : 'text-text-secondary hover:bg-gray-200'
            }`}
          >
            메모
          </button>
          <button
            onClick={() => setActiveTab('aiReport')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              activeTab === 'aiReport' ? 'bg-accent text-white shadow' : 'text-text-secondary hover:bg-gray-200'
            }`}
          >
            AI 기록
          </button>
        </div>
      </div>
      <div className="flex-grow">
        {renderContent()}
      </div>
    </div>
  );
};
