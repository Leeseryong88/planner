
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  position?: { x: number; y: number } | null;
  titleRight?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, position, titleRight }) => {
  if (!isOpen) return null;

  const wrapperClasses = `fixed inset-0 bg-black z-50 ${
    position ? 'bg-opacity-20' : 'bg-opacity-70 backdrop-blur-sm flex justify-center items-center'
  }`;

  return (
    <div 
      className={wrapperClasses}
      onClick={onClose}
    >
      <div 
        className="bg-secondary rounded-xl shadow-2xl w-full max-w-lg p-6 border border-border-color transform transition-all duration-300 scale-95 animate-modal-enter"
        onClick={(e) => e.stopPropagation()}
        style={position ? { position: 'absolute', left: position.x, top: position.y, transform: 'translate(10px, 10px)' } : {}}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-text-main">{title}</h2>
          <div className="flex items-center gap-2">
            {titleRight}
            <button onClick={onClose} className="text-text-secondary hover:text-text-main transition-colors">&times;</button>
          </div>
        </div>
        <div>{children}</div>
      </div>
      <style>{`
        @keyframes modal-enter {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-modal-enter { animation: modal-enter 0.2s ease-out forwards; }
      `}</style>
    </div>
  );
};