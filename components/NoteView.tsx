import React from 'react';
import { ProjectStore } from '../hooks/useProjectStore';
import { MemoBoard } from './MemoBoard';

export const NoteView: React.FC<{ store: ProjectStore }> = ({ store }) => {
  return (
    <div className="bg-secondary/50 rounded-lg p-4 border border-border-color h-[calc(100vh-140px)]">
      <MemoBoard store={store} />
    </div>
  );
};
