export enum ProjectStatus {
  InProgress = 'IN_PROGRESS',
  Completed = 'COMPLETED',
}

export interface Task {
  id: string;
  title: string;
  content: string;
  date?: string; // ISO string format YYYY-MM-DD (Start Date)
  endDate?: string; // ISO string format YYYY-MM-DD
  file?: File;
  fileURL?: string;
  fileName?: string;
  storagePath?: string; // Firebase Storage object path for reliable delete
  completed?: boolean;
  completionDate?: string;
  position: { x: number; y: number };
  projectId: string | null;
  parentTaskId?: string | null;
  lineStyle?: {
    color: string;
    strokeWidth: number;
  }
}

export interface Project {
  id: string;
  title: string;
  content?: string;
  status: ProjectStatus;
  tasks: Task[];
  date?: string; // Start Date
  endDate?: string;
  file?: File;
  fileURL?: string;
  fileName?: string;
  storagePath?: string; // Firebase Storage object path for project attachment
  position: { x: number; y: number };
  isCollapsed?: boolean;
}

export interface Memo {
  id: string;
  content: string;
  position: { x: number; y: number };
  color: string;
  width?: number;
  height?: number;
}

export interface AIReport {
  id: string;
  title: string;
  content: string;
  prompt: string;
  sourceProjectIds: string[];
  sourceDate?: string; // YYYY-MM-DD 형식의 단일 날짜 또는 "YYYY-MM-DD to YYYY-MM-DD" 형식의 날짜 범위 문자열
  createdAt: string;
}