import React from 'react';

// Fix: Explicitly type iconProps to ensure correct property types for SVG elements.
const iconProps: React.SVGProps<SVGSVGElement> = {
  className: "w-5 h-5",
  strokeWidth: "1.5",
  stroke: "currentColor",
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
};

export const LogoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-6 h-6"}>
    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);


export const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg {...iconProps} className={className || iconProps.className}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 5l0 14" />
    <path d="M5 12l14 0" />
  </svg>
);

export const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg {...iconProps} className={className || iconProps.className}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M5 12l5 5l10 -10" />
  </svg>
);

export const EditIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg {...iconProps} className={className || iconProps.className}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
    <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" />
    <path d="M16 5l3 3" />
  </svg>
);

export const CalendarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg {...iconProps} className={className || iconProps.className}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z" />
    <path d="M16 3v4" />
    <path d="M8 3v4" />
    <path d="M4 11h16" />
    <path d="M11 15h1" />
    <path d="M12 15v3" />
  </svg>
);

export const AttachmentIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg {...iconProps} className={className || iconProps.className}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5" />
  </svg>
);


export const DashboardIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg {...iconProps} className={className || iconProps.className} >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M4 4h6v8h-6z" />
        <path d="M4 16h6v4h-6z" />
        <path d="M14 12h6v8h-6z" />
        <path d="M14 4h6v4h-6z" />
    </svg>
);

export const ProjectsIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg {...iconProps} className={className || iconProps.className}>
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M3 4m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" />
        <path d="M7 8h10" />
        <path d="M7 12h10" />
        <path d="M7 16h10" />
    </svg>
);

export const PriorityIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg {...iconProps} className={className || iconProps.className}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 17.5l-5.297 3.113l1.012 -5.902l-4.285 -4.176l5.922 -.861l2.648 -5.374l2.648 5.374l5.922 .861l-4.285 4.176l1.012 5.902z" />
  </svg>
);

export const ChevronLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg {...iconProps} className={className || iconProps.className}>
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M15 6l-6 6l6 6" />
    </svg>
);

export const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg {...iconProps} className={className || iconProps.className}>
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M9 6l6 6l-6 6" />
    </svg>
);

export const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg {...iconProps} className={className || iconProps.className}>
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M6 9l6 6l6 -6" />
    </svg>
);

export const ChevronUpIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg {...iconProps} className={className || iconProps.className}>
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M6 15l6-6 6 6" />
    </svg>
);


export const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg {...iconProps} className={className || iconProps.className}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M4 7l16 0" />
    <path d="M10 11l0 6" />
    <path d="M14 11l0 6" />
    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
    <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
  </svg>
);

export const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg {...iconProps} className={className || iconProps.className}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
    <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
  </svg>
);