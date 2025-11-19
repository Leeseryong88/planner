import { useEffect, useRef, useState } from 'react';
import { Project, Task, ProjectStatus, Memo, AIReport } from '../types';
import { auth, db, storage } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Remove undefined (recursively) so Firestore doesn't reject payloads
function sanitizeForFirestore<T>(input: T): any {
  if (input === null || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(sanitizeForFirestore);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input as any)) {
    if (v === undefined) continue;
    out[k] = sanitizeForFirestore(v as any);
  }
  return out;
}

// 초기 화면 깜빡임 방지를 위해 샘플 데이터 제거 (빈 상태로 시작)
const initialProjects: Project[] = [];
const initialTasks: Task[] = [];

const initialMemos: Memo[] = [
  {
    id: 'memo-1',
    content: '이번 주 금요일 팀 회의 안건 준비:\n- 2분기 실적 리뷰\n- 3분기 목표 설정',
    position: { x: 100, y: 50 },
    color: '#fff9c4', // yellow
    width: 208,
    height: 208,
  },
  {
    id: 'memo-2',
    content: '새로운 디자인 시스템에 대한 사용자 피드백 수집하기.',
    position: { x: 400, y: 150 },
    color: '#c8e6c9', // green
    width: 208,
    height: 208,
  },
];


initialProjects.forEach(p => {
    p.tasks = initialTasks.filter(t => t.projectId === p.id);
});


export const useProjectStore = () => {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const tasksRef = useRef<Task[]>(initialTasks);
  const [memos, setMemos] = useState<Memo[]>(initialMemos);
  const [prioritizedTaskIds, setPrioritizedTaskIds] = useState<string[]>([]);
  const [aiReports, setAIReports] = useState<AIReport[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const memoDebouncedTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // attach Firestore listeners on login
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
        // projects
        const projUnsub = onSnapshot(collection(db, 'users', user.uid, 'projects'), (snap) => {
          const loaded = snap.docs.map(d => {
            const data: any = d.data();
            const p: Project = {
              id: d.id,
              title: data.title,
              content: data.content,
              status: data.status ?? ProjectStatus.InProgress,
              position: data.position ?? { x: 200, y: 200 },
              date: data.date,
              endDate: data.endDate,
              fileURL: data.fileURL,
              fileName: data.fileName,
              isCollapsed: data.isCollapsed ?? false,
              tasks: []
            };
            return p;
          }).map(p => ({
            ...p,
            tasks: tasksRef.current.filter(t => t.projectId === p.id)
          }));
          setProjects(loaded);
        });
        // tasks
        const taskUnsub = onSnapshot(collection(db, 'users', user.uid, 'tasks'), (snap) => {
          const loaded = snap.docs.map(d => {
            const data: any = d.data();
            const t: Task = {
              id: d.id,
              title: data.title,
              content: data.content ?? '',
              date: data.date,
              endDate: data.endDate,
              completed: data.completed ?? false,
              completionDate: data.completionDate,
              position: data.position ?? { x: 0, y: 0 },
              projectId: data.projectId ?? null,
              parentTaskId: data.parentTaskId ?? null,
              lineStyle: data.lineStyle,
              fileURL: data.fileURL,
              fileName: data.fileName
            };
            return t;
          });
          tasksRef.current = loaded;
          setTasks(loaded);
          // also inject into projects
          setProjects(prev => prev.map(p => ({ ...p, tasks: loaded.filter(t => t.projectId === p.id) })));
        });
        // memos
        const memoUnsub = onSnapshot(collection(db, 'users', user.uid, 'memos'), (snap) => {
          const loaded = snap.docs.map(d => {
            const data: any = d.data();
            const m: Memo = {
              id: d.id,
              content: data.content ?? '',
              position: data.position ?? { x: 0, y: 0 },
              color: data.color ?? '#fff9c4',
              width: data.width,
              height: data.height
            };
            return m;
          });
          setMemos(loaded);
        });
        // state (prioritizedTaskIds)
        const stateUnsub = onSnapshot(doc(db, 'users', user.uid, 'state', 'app'), (snap) => {
          const data: any = snap.data();
          const raw = Array.isArray(data?.prioritizedTaskIds) ? data.prioritizedTaskIds : [];
          // Deduplicate on read just in case persisted state has duplicates
          const unique = Array.from(new Set(raw));
          setPrioritizedTaskIds(unique);
        });
        // cleanup on logout or unmount
        return () => {
          projUnsub();
          taskUnsub();
          memoUnsub();
          stateUnsub();
        };
      } else {
        setUid(null);
        setProjects(initialProjects);
        setTasks(initialTasks);
        setMemos(initialMemos);
        setPrioritizedTaskIds([]);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const addProject = (projectData: Omit<Project, 'id' | 'status' | 'tasks' | 'position'>, position?: { x: number; y: number }) => {
    const newProject: Project = {
      ...projectData,
      id: `proj-${Date.now()}`,
      status: ProjectStatus.InProgress,
      tasks: [],
      position: position || { x: 200, y: 200 }, // Default position for new projects
      isCollapsed: false,
    };
    setProjects(prev => [newProject, ...prev]);
    if (uid) {
      const { tasks: _omitTasks, file, ...toSave } = newProject as any;
      setDoc(doc(db, 'users', uid, 'projects', newProject.id), sanitizeForFirestore({ ...toSave, fileURL: toSave.fileURL || null, fileName: toSave.fileName || null, storagePath: null }))
        .then(async () => {
          if (file instanceof File) {
            const path = `users/${uid}/projects/${newProject.id}/${file.name}`;
            const sRef = storageRef(storage, path);
            await uploadBytes(sRef, file);
            const url = await getDownloadURL(sRef);
            await updateDoc(doc(db, 'users', uid, 'projects', newProject.id), { fileURL: url, fileName: file.name, storagePath: path });
          }
        })
        .catch(() => {});
    }
  };

  const updateProject = (projectId: string, projectData: Partial<Omit<Project, 'position'>>) => {
    setProjects(prev =>
      prev.map(p => (p.id === projectId ? { ...p, ...projectData } : p))
    );
    if (uid) {
      const { tasks: _ignore, file, ...rest } = projectData as any;
      const payload = sanitizeForFirestore(rest);
      if (Object.keys(payload).length > 0) {
        updateDoc(doc(db, 'users', uid, 'projects', projectId), payload).catch(() => {});
      }
      if (file instanceof File) {
        const path = `users/${uid}/projects/${projectId}/${file.name}`;
        const sRef = storageRef(storage, path);
        // try delete old file first (best-effort)
        try {
          const existing = projects.find(p => p.id === projectId);
          const oldPath = (existing as any)?.storagePath;
          if (oldPath) {
            deleteObject(storageRef(storage, oldPath)).catch(() => {});
          }
        } catch {}
        uploadBytes(sRef, file)
          .then(() => getDownloadURL(sRef))
          .then((url) => updateDoc(doc(db, 'users', uid, 'projects', projectId), { fileURL: url, fileName: file.name, storagePath: path }))
          .catch(() => {});
      }
    }
  };
  
  const moveProjectGroup = (projectId: string, delta: { dx: number; dy: number }) => {
    const projectToMove = projects.find(p => p.id === projectId);
    if (!projectToMove) return;

    // Helper to find all descendant tasks of a set of tasks
    const getAllDescendantTaskIds = (startTaskIds: string[], allTasks: Task[]): Set<string> => {
        const allDescendants = new Set<string>();
        const queue = [...startTaskIds];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const currentTaskId = queue.shift()!;
            if (visited.has(currentTaskId)) continue;
            
            visited.add(currentTaskId);
            allDescendants.add(currentTaskId);

            const children = allTasks.filter(t => t.parentTaskId === currentTaskId);
            for (const child of children) {
                if (!visited.has(child.id)) {
                    queue.push(child.id);
                }
            }
        }
        return allDescendants;
    };

    // Get direct child tasks of the project from both project cache and master list
    const directTaskIdSet = new Set<string>();
    projectToMove.tasks.forEach(t => directTaskIdSet.add(t.id));
    tasks
      .filter(t => t.projectId === projectId)
      .forEach(t => directTaskIdSet.add(t.id));
    const directTaskIds = Array.from(directTaskIdSet);
    
    // Get all descendant tasks, including direct children
    const allTaskIdsToMove = getAllDescendantTaskIds(directTaskIds, tasks);

    // Update the main tasks state
    const updatedTasks = tasks.map(t => {
      if (allTaskIdsToMove.has(t.id)) {
        return {
          ...t,
          position: { x: t.position.x + delta.dx, y: t.position.y + delta.dy },
        };
      }
      return t;
    });
    setTasks(updatedTasks);

    // Update the projects state
    const updatedProjects = projects.map(p => {
      if (p.id === projectId) {
        // Move the project itself
        const newProjectPos = { x: p.position.x + delta.dx, y: p.position.y + delta.dy };
        const newTasksInProject = updatedTasks.filter(t => t.projectId === projectId);
        return { ...p, position: newProjectPos, tasks: newTasksInProject };
      }
      return p;
    });
    setProjects(updatedProjects);
    if (uid) {
      const batch = writeBatch(db);
      // update project position
      const proj = updatedProjects.find(p => p.id === projectId);
      if (proj) {
        batch.update(doc(db, 'users', uid, 'projects', projectId), sanitizeForFirestore({ position: proj.position }));
      }
      // update moved tasks
      updatedTasks.forEach(t => {
        if (allTaskIdsToMove.has(t.id)) {
          batch.update(doc(db, 'users', uid, 'tasks', t.id), sanitizeForFirestore({ position: t.position }));
        }
      });
      batch.commit().catch(() => {});
    }
  };

  const moveTaskSubtree = (rootTaskId: string, delta: { dx: number; dy: number }) => {
    if (delta.dx === 0 && delta.dy === 0) return;
    const rootTask = tasks.find(t => t.id === rootTaskId);
    if (!rootTask) return;

    const getAllDescendantTaskIds = (startTaskIds: string[], allTasks: Task[]): Set<string> => {
      const allDescendants = new Set<string>();
      const queue = [...startTaskIds];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const currentTaskId = queue.shift()!;
        if (visited.has(currentTaskId)) continue;

        visited.add(currentTaskId);
        allDescendants.add(currentTaskId);

        const children = allTasks.filter(t => t.parentTaskId === currentTaskId);
        for (const child of children) {
          if (!visited.has(child.id)) {
            queue.push(child.id);
          }
        }
      }
      return allDescendants;
    };

    const idsToMove = getAllDescendantTaskIds([rootTaskId], tasks);
    if (idsToMove.size === 0) return;
    const newPositions = new Map<string, { x: number; y: number }>();

    const updatedTasks = tasks.map(t => {
      if (idsToMove.has(t.id)) {
        const newPos = { x: t.position.x + delta.dx, y: t.position.y + delta.dy };
        newPositions.set(t.id, newPos);
        return { ...t, position: newPos };
      }
      return t;
    });
    setTasks(updatedTasks);

    setProjects(prev => prev.map(p => ({
      ...p,
      tasks: p.tasks.map(t => idsToMove.has(t.id) ? { ...t, position: newPositions.get(t.id)! } : t)
    })));

    if (uid) {
      const batch = writeBatch(db);
      newPositions.forEach((pos, id) => {
        batch.update(doc(db, 'users', uid, 'tasks', id), sanitizeForFirestore({ position: pos }));
      });
      batch.commit().catch(() => {});
    }
  };


  const finishProject = (projectId: string) => {
    const projectToFinish = projects.find(p => p.id === projectId);
    if (!projectToFinish) return;

    // Helper to find all descendant tasks of a set of tasks
    const getAllDescendantTaskIds = (startTaskIds: string[], allTasks: Task[]): Set<string> => {
        const allDescendants = new Set<string>();
        const queue = [...startTaskIds];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const currentTaskId = queue.shift()!;
            if (visited.has(currentTaskId)) continue;
            
            visited.add(currentTaskId);
            allDescendants.add(currentTaskId);

            const children = allTasks.filter(t => t.parentTaskId === currentTaskId);
            for (const child of children) {
                if (!visited.has(child.id)) {
                    queue.push(child.id);
                }
            }
        }
        return allDescendants;
    };
    
    // Get all task IDs associated with this project (direct and descendants)
    const directTaskIds = projectToFinish.tasks.map(t => t.id);
    const allTaskIdsInProjectTree = getAllDescendantTaskIds(directTaskIds, tasks);

    // Remove these tasks from the prioritized list
    setPrioritizedTaskIds(prev => prev.filter(id => !allTaskIdsInProjectTree.has(id)));

    // Update the project status
    setProjects(prev =>
     prev.map(p =>
       p.id === projectId ? { ...p, status: ProjectStatus.Completed, isCollapsed: true } : p
     )
   );
   if (uid) {
     updateDoc(doc(db, 'users', uid, 'projects', projectId), sanitizeForFirestore({ status: ProjectStatus.Completed, isCollapsed: true })).catch(() => {});
   }
 };

  const reactivateProject = (projectId: string) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId ? { ...p, status: ProjectStatus.InProgress, isCollapsed: false } : p
      )
    );
    if (uid) {
      updateDoc(doc(db, 'users', uid, 'projects', projectId), sanitizeForFirestore({ status: ProjectStatus.InProgress, isCollapsed: false })).catch(() => {});
    }
    // After reactivation, append this project's tasks back to prioritized list (at bottom)
    try {
      // Collect all descendant task ids for this project
      const directTaskIds = tasks.filter(t => t.projectId === projectId).map(t => t.id);
      const getAllDescendantTaskIds = (startTaskIds: string[], allTasks: Task[]): Set<string> => {
        const allDescendants = new Set<string>();
        const queue = [...startTaskIds];
        const visited = new Set<string>();
        while (queue.length > 0) {
          const currentTaskId = queue.shift()!;
          if (visited.has(currentTaskId)) continue;
          visited.add(currentTaskId);
          allDescendants.add(currentTaskId);
          const children = allTasks.filter(t => t.parentTaskId === currentTaskId);
          for (const child of children) {
            if (!visited.has(child.id)) queue.push(child.id);
          }
        }
        return allDescendants;
      };
      const allTaskIds = Array.from(getAllDescendantTaskIds(directTaskIds, tasks));
      // Keep only not-completed tasks
      const activeIds = allTaskIds.filter(id => {
        const t = tasks.find(x => x.id === id);
        return t ? !t.completed : true;
      });
      if (activeIds.length > 0) {
        setPrioritizedTasks([...prioritizedTaskIds, ...activeIds]);
      }
    } catch {}
  };

  const toggleProjectCollapse = (projectId: string) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId ? { ...p, isCollapsed: !p.isCollapsed } : p
      )
    );
    if (uid) {
      const p = projects.find(p => p.id === projectId);
      updateDoc(doc(db, 'users', uid, 'projects', projectId), sanitizeForFirestore({ isCollapsed: !(p?.isCollapsed ?? false) })).catch(() => {});
    }
  };

  const deleteProject = (projectId: string) => {
    // collect all tasks in this project (direct + descendants)
    const directTaskIds = tasks.filter(t => t.projectId === projectId).map(t => t.id);
    const getAllDescendantTaskIds = (startTaskIds: string[], allTasks: Task[]): Set<string> => {
      const allDescendants = new Set<string>();
      const queue = [...startTaskIds];
      const visited = new Set<string>();
      while (queue.length > 0) {
        const currentTaskId = queue.shift()!;
        if (visited.has(currentTaskId)) continue;
        visited.add(currentTaskId);
        allDescendants.add(currentTaskId);
        const children = allTasks.filter(t => t.parentTaskId === currentTaskId);
        for (const child of children) {
          if (!visited.has(child.id)) queue.push(child.id);
        }
      }
      return allDescendants;
    };
    const allTaskIdsToDelete = getAllDescendantTaskIds(directTaskIds, tasks);

    // local state update
    setTasks(prev => prev.filter(t => !allTaskIdsToDelete.has(t.id)));
    setProjects(prev => prev.filter(p => p.id !== projectId));
    setPrioritizedTaskIds(prev => prev.filter(id => !allTaskIdsToDelete.has(id)));

    if (uid) {
      const batch = writeBatch(db);
      // delete project doc
      batch.delete(doc(db, 'users', uid, 'projects', projectId));
      // delete tasks docs
      allTaskIdsToDelete.forEach(taskId => {
        batch.delete(doc(db, 'users', uid, 'tasks', taskId));
      });
      batch.commit().catch(() => {});
      // delete project's own attachment in storage (best-effort)
      const proj = projects.find(p => p.id === projectId);
      if (proj) {
        let pPath: string | null = (proj as any).storagePath || null;
        if (!pPath && proj.fileURL) {
          try {
            const u = new URL(proj.fileURL);
            const encoded = u.pathname.split('/o/')[1]?.split('?')[0];
            pPath = encoded ? decodeURIComponent(encoded) : null;
          } catch {}
        }
        if (pPath) {
          try { deleteObject(storageRef(storage, pPath)); } catch {}
        }
      }
      // delete storage objects for those tasks
      const relatedTasks = tasks.filter(t => allTaskIdsToDelete.has(t.id));
      relatedTasks.forEach(t => {
        let path: string | null = (t as any).storagePath || null;
        if (!path && t.fileURL) {
          try {
            const u = new URL(t.fileURL);
            const encoded = u.pathname.split('/o/')[1]?.split('?')[0];
            path = encoded ? decodeURIComponent(encoded) : null;
          } catch {}
        }
        if (path) {
          try { deleteObject(storageRef(storage, path)); } catch {}
        }
      });
    }
  };

  const addTask = (taskData: Omit<Task, 'id' | 'completed'>) => {
    const newTask: Task = {
      ...taskData,
      id: `task-${Date.now()}`,
      completed: false,
      parentTaskId: null,
    };
    
    setTasks(prev => [...prev, newTask]);

    if(newTask.projectId) {
      setProjects(prev => prev.map(p => 
        p.id === newTask.projectId ? {...p, tasks: [...p.tasks, newTask]} : p
      ))
    }
    // Append to prioritized list unconditionally for new tasks (bottom of list)
    try {
      if (!prioritizedTaskIds.includes(newTask.id)) {
        const next = [...prioritizedTaskIds, newTask.id];
        setPrioritizedTaskIds(next);
        if (uid) {
          setDoc(doc(db, 'users', uid, 'state', 'app'), { prioritizedTaskIds: next }, { merge: true }).catch(() => {});
        }
      }
    } catch {}
    if (uid) {
      const { file, ...toSave } = newTask as any;
      // 1) 처음 문서 저장 (fileURL 없이)
      setDoc(doc(db, 'users', uid, 'tasks', newTask.id), sanitizeForFirestore({ ...toSave, fileURL: toSave.fileURL || null, fileName: toSave.fileName || null, storagePath: null }))
        .then(async () => {
          // 2) 파일이 있으면 Storage 업로드 후 다운로드 URL로 갱신
          if (file instanceof File) {
            const path = `users/${uid}/tasks/${newTask.id}/${file.name}`;
            const sRef = storageRef(storage, path);
            await uploadBytes(sRef, file);
            const url = await getDownloadURL(sRef);
            await updateDoc(doc(db, 'users', uid, 'tasks', newTask.id), { fileURL: url, fileName: file.name, storagePath: path });
          }
        })
        .catch(() => {});
    }
  };

  const updateTask = (taskId: string, taskData: Partial<Task>) => {
    if (taskData.completed) {
      setPrioritizedTaskIds(prev => prev.filter(id => id !== taskId));
    }
    setTasks(prev => prev.map(t => t.id === taskId ? {...t, ...taskData} : t));
    setProjects(prev => prev.map(p => ({
      ...p,
      tasks: p.tasks.map(t => t.id === taskId ? {...t, ...taskData} : t)
    })));
    if (uid) {
      const { file, ...rest } = taskData as any;
      const payload = sanitizeForFirestore(rest);
      if (Object.keys(payload).length > 0) {
        updateDoc(doc(db, 'users', uid, 'tasks', taskId), payload).catch(() => {});
      }
      // 파일이 새로 들어온 경우 업로드 후 fileURL 교체
      if (file instanceof File) {
        const path = `users/${uid}/tasks/${taskId}/${file.name}`;
        const sRef = storageRef(storage, path);
        uploadBytes(sRef, file)
          .then(() => getDownloadURL(sRef))
          .then((url) => updateDoc(doc(db, 'users', uid, 'tasks', taskId), { fileURL: url, fileName: file.name, storagePath: path }))
          .catch(() => {});
      }
    }
  };
  
  const updateTaskPosition = (taskId: string, position: {x: number, y: number}) => {
     setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, position } : t)));
     setProjects(prev => prev.map(p => ({
        ...p,
        tasks: p.tasks.map(t => (t.id === taskId ? { ...t, position } : t))
     })))
     if (uid) {
       updateDoc(doc(db, 'users', uid, 'tasks', taskId), sanitizeForFirestore({ position })).catch(() => {});
     }
  }

  const deleteTask = (taskId: string) => {
    const taskToDelete = tasks.find(t => t.id === taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (taskToDelete?.projectId) {
        setProjects(prev => prev.map(p => 
            p.id === taskToDelete.projectId ? {...p, tasks: p.tasks.filter(t => t.id !== taskId)} : p
        ));
    }
    setPrioritizedTaskIds(prev => prev.filter(id => id !== taskId));
    if (uid) {
      deleteDoc(doc(db, 'users', uid, 'tasks', taskId)).catch(() => {});
      // Storage의 파일도 함께 삭제 시도 (있다면)
      let path: string | null = (taskToDelete as any)?.storagePath || null;
      if (!path && taskToDelete?.fileURL) {
        try {
          const u = new URL(taskToDelete.fileURL);
          const encoded = u.pathname.split('/o/')[1]?.split('?')[0];
          path = encoded ? decodeURIComponent(encoded) : null;
        } catch {}
      }
      if (path) {
        try { deleteObject(storageRef(storage, path)); } catch {}
      }
    }
  };

  const linkTaskToProject = (taskId: string, projectId: string) => {
    let taskToLink: Task | undefined;
    
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        taskToLink = { ...t, projectId, parentTaskId: null }; // Also unlink from parent task
        return taskToLink;
      }
      return t;
    }));

    if (taskToLink) {
      const finalTask = taskToLink; // To satisfy typescript compiler
      setProjects(prev => prev.map(p => {
        if (p.id === projectId) {
          return { ...p, tasks: [...p.tasks, finalTask] };
        }
        return p;
      }));
    }
    if (uid) {
      updateDoc(doc(db, 'users', uid, 'tasks', taskId), sanitizeForFirestore({ projectId, parentTaskId: null })).catch(() => {});
    }
  };

  const linkTaskToTask = (childTaskId: string, parentTaskId: string) => {
    const completionTimestamp = new Date().toISOString();
    // Preserve existing completionDate of parent if already completed
    const parentBefore = tasks.find(t => t.id === parentTaskId);
    const effectiveCompletionDate = parentBefore?.completionDate ?? completionTimestamp;
    setPrioritizedTaskIds(prev => [...prev.filter(id => id !== parentTaskId), childTaskId]);
    setTasks(prev => prev.map(t => {
      if (t.id === childTaskId) {
        // Link to parent task and unlink from project
        return { ...t, parentTaskId: parentTaskId, projectId: null };
      }
      if (t.id === parentTaskId) {
        // Mark parent task as completed
        return { ...t, completed: true, completionDate: effectiveCompletionDate };
      }
      return t;
    }));

    // Also update tasks inside projects state
    setProjects(prev => {
        // Find the project of the child task to remove it from there
        const childTaskProject = prev.find(p => p.tasks.some(t => t.id === childTaskId));
        
        return prev.map(p => {
            const newTasks = p.tasks.map(t => {
                if (t.id === parentTaskId) {
                    return { ...t, completed: true, completionDate: effectiveCompletionDate };
                }
                return t;
            });
            
            // If this project contained the child task, remove it
            if (childTaskProject && p.id === childTaskProject.id) {
                return {...p, tasks: newTasks.filter(t => t.id !== childTaskId)};
            }

            return {...p, tasks: newTasks};
        });
    });
    if (uid) {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', uid, 'tasks', childTaskId), sanitizeForFirestore({ parentTaskId, projectId: null }));
      batch.update(doc(db, 'users', uid, 'tasks', parentTaskId), sanitizeForFirestore({ completed: true, completionDate: effectiveCompletionDate }));
      batch.commit().catch(() => {});
    }
  };

  const unlinkTask = (projectId: string, taskId: string) => {
    let taskToUnlink: Task | undefined;

    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        taskToUnlink = p.tasks.find(t => t.id === taskId);
        return { ...p, tasks: p.tasks.filter(t => t.id !== taskId) };
      }
      return p;
    }));
    
    if (taskToUnlink) {
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return { ...t, projectId: null };
        }
        return t;
      }));
    }
    if (uid) {
      updateDoc(doc(db, 'users', uid, 'tasks', taskId), sanitizeForFirestore({ projectId: null })).catch(() => {});
    }
  };

  const unlinkTaskFromParent = (childTaskId: string) => {
    const childTask = tasks.find(t => t.id === childTaskId);
    if (!childTask || !childTask.parentTaskId) return;

    let ancestorProjectId: string | null = null;
    let parentId: string | null | undefined = childTask.parentTaskId;
    while (parentId) {
      const parentTask = tasks.find(t => t.id === parentId);
      if (!parentTask) break;
      if (parentTask.projectId) {
        ancestorProjectId = parentTask.projectId;
        break;
      }
      parentId = parentTask.parentTaskId ?? null;
    }

    const updatedChild = { ...childTask, parentTaskId: null, projectId: ancestorProjectId };
    setTasks(prev => prev.map(t => (t.id === childTaskId ? updatedChild : t)));
    setProjects(prev => prev.map(p => {
      const filtered = p.tasks.filter(t => t.id !== childTaskId);
      if (ancestorProjectId && p.id === ancestorProjectId) {
        return { ...p, tasks: [...filtered, updatedChild] };
      }
      return { ...p, tasks: filtered };
    }));
    if (uid) {
      updateDoc(doc(db, 'users', uid, 'tasks', childTaskId), sanitizeForFirestore({ parentTaskId: null, projectId: ancestorProjectId })).catch(() => {});
    }
  };

  const updateLineStyle = (taskId: string, lineStyle: Task['lineStyle']) => {
    updateTask(taskId, { lineStyle });
  };

  const addMemo = (memoData: Omit<Memo, 'id'>) => {
    const newMemo: Memo = {
      ...memoData,
      id: `memo-${Date.now()}`,
    };
    setMemos(prev => [...prev, newMemo]);
    if (uid) {
      setDoc(doc(db, 'users', uid, 'memos', newMemo.id), sanitizeForFirestore(newMemo as any)).catch(() => {});
    }
  };

  const updateMemo = (memoId: string, memoData: Partial<Omit<Memo, 'id'>>) => {
    // Local state update for smooth UI
    setMemos(prev => prev.map(m => m.id === memoId ? { ...m, ...memoData } : m));
    // Debounce Firestore writes to avoid lag during drag/resize
    if (uid) {
      const payload = sanitizeForFirestore(memoData as any);
      if (Object.keys(payload).length > 0) {
        const existing = memoDebouncedTimers.current.get(memoId);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          updateDoc(doc(db, 'users', uid, 'memos', memoId), payload).catch(() => {});
          memoDebouncedTimers.current.delete(memoId);
        }, 200);
        memoDebouncedTimers.current.set(memoId, timer);
      }
    }
  };

  const deleteMemo = (memoId: string) => {
    setMemos(prev => prev.filter(m => m.id !== memoId));
    if (uid) {
      deleteDoc(doc(db, 'users', uid, 'memos', memoId)).catch(() => {});
    }
  };

  const addAIReport = (reportData: Omit<AIReport, 'id'>) => {
    const newReport: AIReport = {
      ...reportData,
      id: `report-${Date.now()}`,
    };
    setAIReports(prev => [newReport, ...prev]);
  };

  const deleteAIReport = (reportId: string) => {
    setAIReports(prev => prev.filter(r => r.id !== reportId));
  };

  // Cleanup debounced timers on unmount
  useEffect(() => {
    return () => {
      memoDebouncedTimers.current.forEach((t) => clearTimeout(t));
      memoDebouncedTimers.current.clear();
    };
  }, []);

  // Persist prioritizedTaskIds
  const setPrioritizedTasks = (ids: string[]) => {
    const unique = Array.from(new Set(ids));
    setPrioritizedTaskIds(unique);
    if (uid) {
      setDoc(doc(db, 'users', uid, 'state', 'app'), { prioritizedTaskIds: unique }, { merge: true }).catch(() => {});
    }
  };

  // Auto arrange tasks for a project: layered rightward layout
  const autoArrangeProjectTasks = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    // Build adjacency for ALL tasks first
    const childrenByParent = new Map<string, Task[]>();
    tasks.forEach(t => {
      if (t.parentTaskId) {
        const arr = childrenByParent.get(t.parentTaskId) || [];
        arr.push(t);
        childrenByParent.set(t.parentTaskId, arr);
      }
    });
    // Roots: tasks directly linked to the project (no parentTaskId)
    const roots = tasks.filter(t => t.projectId === projectId && !t.parentTaskId);
    // Collect every descendant reachable from roots (any depth)
    const inProjectSet = new Set<string>();
    const collectDescendants = (task: Task) => {
      if (inProjectSet.has(task.id)) return;
      inProjectSet.add(task.id);
      const kids = (childrenByParent.get(task.id) || []);
      for (const k of kids) collectDescendants(k);
    };
    for (const r of roots) collectDescendants(r);
    // Stable order
    const taskSorter = (a: Task, b: Task) => (a.title || '').localeCompare(b.title || '') || a.id.localeCompare(b.id);
    roots.sort(taskSorter);
    childrenByParent.forEach(list => list.sort(taskSorter));

    // Compute subtree row requirements
    const subtreeSizeCache = new Map<string, number>();
    const getSubtreeRows = (taskId: string): number => {
      if (subtreeSizeCache.has(taskId)) return subtreeSizeCache.get(taskId)!;
      // Only consider children within this project's subtree
      const kids = (childrenByParent.get(taskId) || []).filter(k => inProjectSet.has(k.id));
      if (kids.length === 0) {
        subtreeSizeCache.set(taskId, 1);
        return 1;
      }
      let sum = 0;
      for (const k of kids) sum += getSubtreeRows(k.id);
      sum = Math.max(sum, 1);
      subtreeSizeCache.set(taskId, sum);
      return sum;
    };

    // Assign rows and depths
    type RowDepth = { row: number; depth: number };
    const rowDepthById = new Map<string, RowDepth>();
    let currentRow = 0;
    const assign = (t: Task, depth: number, startRow: number) => {
      const rows = getSubtreeRows(t.id);
      const myRow = startRow + Math.floor((rows - 1) / 2);
      rowDepthById.set(t.id, { row: myRow, depth });
      // children stacked in order (filtered to this subtree)
      const kids = (childrenByParent.get(t.id) || []).filter(k => inProjectSet.has(k.id));
      let s = startRow;
      for (const k of kids) {
        const need = getSubtreeRows(k.id);
        assign(k, depth + 1, s);
        s += need;
      }
    };

    for (const r of roots) {
      const need = getSubtreeRows(r.id);
      assign(r, 1, currentRow);
      currentRow += need + 1; // one row gap between subtrees
    }

    if (rowDepthById.size === 0) return;

    // Compute centered Y positions
    const rowSpacing = 140; // vertical spacing per row
    const colSpacing = 280; // horizontal spacing per depth
    const totalRows = currentRow > 0 ? currentRow - 1 : 0;
    const centerY = project.position.y;
    const rowToY = (row: number) => centerY + (row - (totalRows - 1) / 2) * rowSpacing;

    const newPositions = new Map<string, { x: number; y: number }>();
    rowDepthById.forEach((rd, id) => {
      const x = project.position.x + rd.depth * colSpacing;
      const y = rowToY(rd.row);
      newPositions.set(id, { x, y });
    });

    // Update local state
    setTasks(prev => prev.map(t => (newPositions.has(t.id) ? { ...t, position: newPositions.get(t.id)! } : t)));
    setProjects(prev => prev.map(p => p.id === projectId ? ({
      ...p,
      tasks: p.tasks.map(t => (newPositions.has(t.id) ? { ...t, position: newPositions.get(t.id)! } : t))
    }) : p));

    // Persist in Firestore
    if (uid) {
      const batch = writeBatch(db);
      newPositions.forEach((pos, id) => {
        batch.update(doc(db, 'users', uid, 'tasks', id), sanitizeForFirestore({ position: pos }));
      });
      batch.commit().catch(() => {});
    }
  };

  return {
    projects,
    tasks,
    memos,
    aiReports,
    prioritizedTaskIds,
    unlinkedTasks: tasks.filter(t => !t.projectId),
    addProject,
    updateProject,
    finishProject,
    reactivateProject,
    toggleProjectCollapse,
    deleteProject,
    addTask,
    updateTask,
    deleteTask,
    moveProjectGroup,
    updateTaskPosition,
    moveTaskSubtree,
    linkTaskToProject,
    linkTaskToTask,
    unlinkTask,
    unlinkTaskFromParent,
    updateLineStyle,
    addMemo,
    updateMemo,
    deleteMemo,
    addAIReport,
    deleteAIReport,
    setPrioritizedTasks,
    autoArrangeProjectTasks,
  };
};

export type ProjectStore = ReturnType<typeof useProjectStore>;