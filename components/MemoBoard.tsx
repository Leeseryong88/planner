import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ProjectStore } from '../hooks/useProjectStore';
import { Memo } from '../types';
import { TrashIcon } from './icons';

const MemoItem: React.FC<{ memo: Memo; store: ProjectStore }> = ({ memo, store }) => {
    const [isDragging, setIsDragging] = useState(false);
    const rafIdRef = useRef<number | null>(null);
    const lastPosRef = useRef({ x: 0, y: 0 });
    const memoRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);
    const initialResizeRef = useRef({ width: 0, height: 0, x: 0, y: 0 });
    const MIN_WIDTH = 160;
    const MIN_HEIGHT = 160;

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as Element;
        // textarea, button, resize handle 클릭 시 드래그 방지
        if (target instanceof HTMLTextAreaElement || target.closest('button') || target.classList.contains('memo-resize-handle')) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        lastPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !memoRef.current) return;
        if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
            const parentRect = memoRef.current?.parentElement?.getBoundingClientRect();
            if (!parentRect) return;

            const delta = {
                dx: e.clientX - lastPosRef.current.x,
                dy: e.clientY - lastPosRef.current.y,
            };
            lastPosRef.current = { x: e.clientX, y: e.clientY };
            
            const currentWidth = memo.width || MIN_WIDTH;
            const currentHeight = memo.height || MIN_HEIGHT;
            
            const newX = Math.max(0, Math.min(memo.position.x + delta.dx, parentRect.width - currentWidth));
            const newY = Math.max(0, Math.min(memo.position.y + delta.dy, parentRect.height - currentHeight));

            store.updateMemo(memo.id, {
                position: { x: newX, y: newY },
            });
        });
    }, [isDragging, store, memo.id, memo.position, memo.width, memo.height]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);
        initialResizeRef.current = {
            width: memo.width || MIN_WIDTH,
            height: memo.height || MIN_HEIGHT,
            x: e.clientX,
            y: e.clientY,
        };
    };

    const handleResizeMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing) return;

        const dx = e.clientX - initialResizeRef.current.x;
        const dy = e.clientY - initialResizeRef.current.y;

        const newWidth = Math.max(MIN_WIDTH, initialResizeRef.current.width + dx);
        const newHeight = Math.max(MIN_HEIGHT, initialResizeRef.current.height + dy);

        store.updateMemo(memo.id, {
            width: newWidth,
            height: newHeight,
        });

    }, [isResizing, store, memo.id]);

    const handleResizeMouseUp = useCallback(() => {
        setIsResizing(false);
    }, []);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleResizeMouseMove);
            window.addEventListener('mouseup', handleResizeMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleResizeMouseMove);
                window.removeEventListener('mouseup', handleResizeMouseUp);
            };
        }
    }, [isResizing, handleResizeMouseMove, handleResizeMouseUp]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('mouseleave', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('mouseleave', handleMouseUp);
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        store.updateMemo(memo.id, { content: e.target.value });
    };

    const rotation = useRef(Math.random() * 4 - 2).current;

    return (
        <div
            ref={memoRef}
            onMouseDown={handleMouseDown}
            className="absolute p-4 shadow-lg transition-transform duration-150 ease-in-out cursor-grab flex flex-col"
            style={{
                left: memo.position.x,
                top: memo.position.y,
                width: `${memo.width || MIN_WIDTH}px`,
                height: `${memo.height || MIN_HEIGHT}px`,
                backgroundColor: memo.color,
                transform: `rotate(${rotation}deg)`,
                ...(isDragging && {
                    cursor: 'grabbing',
                    transform: `scale(1.05) rotate(${rotation}deg)`,
                    zIndex: 1000,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }),
            }}
        >
            <button
                onClick={() => store.deleteMemo(memo.id)}
                className="absolute top-1 right-1 p-1 text-gray-500 hover:text-red-500 hover:bg-black/10 rounded-full z-10"
                aria-label="메모 삭제"
            >
                <TrashIcon className="w-4 h-4" />
            </button>
            <textarea
                value={memo.content}
                onChange={handleContentChange}
                placeholder="여기에 메모..."
                className="flex-grow w-full bg-transparent border-none resize-none focus:outline-none p-2 text-text-main font-medium leading-normal"
                aria-label="메모 내용"
            />
            <div
                onMouseDown={handleResizeMouseDown}
                className="memo-resize-handle absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-20"
            >
                <svg className="absolute bottom-0 right-0 text-black/20" width="12" height="12" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 0L0 10" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 4L4 10" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
            </div>
        </div>
    );
};

const MEMO_COLORS = ['#fff9c4', '#c8e6c9', '#bbdefb', '#ffcdd2', '#f8bbd0', '#d1c4e9'];

export const MemoBoard: React.FC<{ store: ProjectStore }> = ({ store }) => {
    const boardRef = useRef<HTMLDivElement>(null);
    const [colorPalette, setColorPalette] = useState<{ x: number; y: number } | null>(null);
    const justOpenedRef = useRef(false);

    const handleBoardDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return;
        const boardRect = boardRef.current?.getBoundingClientRect();
        if (!boardRect) return;
        const x = e.clientX - boardRect.left;
        const y = e.clientY - boardRect.top;
        setColorPalette({ x, y });
        // 더블클릭 직후 발생하는 클릭으로 인해 즉시 닫히는 문제 방지
        justOpenedRef.current = true;
        setTimeout(() => { justOpenedRef.current = false; }, 300);
    };
    
    const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            if (justOpenedRef.current) return;
            if (colorPalette) {
                setColorPalette(null);
            }
        }
    };

    const handleColorSelect = (color: string) => {
        if (!colorPalette || !boardRef.current) return;
        
        const boardRect = boardRef.current.getBoundingClientRect();
        const memoWidth = 208;
        const memoHeight = 208;
        
        let x = colorPalette.x - (memoWidth / 2);
        let y = colorPalette.y - (memoHeight / 2);
        
        x = Math.max(0, Math.min(x, boardRect.width - memoWidth));
        y = Math.max(0, Math.min(y, boardRect.height - memoHeight));

        store.addMemo({
            content: '',
            position: { x, y },
            color,
            width: memoWidth,
            height: memoHeight,
        });
        setColorPalette(null);
    };


    return (
        <div 
            className="relative w-full h-full overflow-hidden bg-primary rounded-lg shadow-inner"
            ref={boardRef}
            onDoubleClick={handleBoardDoubleClick}
            onClick={handleBoardClick}
        >
            {colorPalette && (
                <div
                    className="absolute z-30 flex gap-2 p-2 bg-secondary rounded-full shadow-xl border border-border-color animate-fade-in-scale"
                    style={{
                        left: colorPalette.x,
                        top: colorPalette.y,
                        transform: 'translate(-50%, -50%)',
                    }}
                >
                    {MEMO_COLORS.map(color => (
                        <button
                            key={color}
                            onClick={() => handleColorSelect(color)}
                            className="w-8 h-8 rounded-full border-2 border-white shadow-md transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                            style={{ backgroundColor: color }}
                            aria-label={`메모 색상 ${color} 선택`}
                        />
                    ))}
                </div>
            )}

            {store.memos.map(memo => (
                <MemoItem key={memo.id} memo={memo} store={store} />
            ))}
             {store.memos.length === 0 && (
                <div className="flex justify-center items-center h-full text-text-secondary text-center pointer-events-none">
                    <div>
                        <p>메모가 없습니다.</p>
                        <p className="text-sm">빈 공간을 더블클릭하여 메모를 추가하세요.</p>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes fade-in-scale {
                    from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
                .animate-fade-in-scale { animation: fade-in-scale 0.2s ease-out forwards; }
            `}</style>
        </div>
    );
};