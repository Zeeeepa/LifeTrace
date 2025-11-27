'use client';

import { Layers, FolderOpen } from 'lucide-react';

export type AppMode = 'collector' | 'workspace';

interface ModeSwitcherProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  collectorLabel: string;
  workspaceLabel: string;
}

export default function ModeSwitcher({
  mode,
  onModeChange,
  collectorLabel,
  workspaceLabel,
}: ModeSwitcherProps) {
  return (
    <div className="relative flex items-center rounded-full bg-muted p-1 gap-1">
      {/* 滑动背景 */}
      <div
        className={`absolute inset-y-1 rounded-full bg-background shadow-sm transition-all duration-300 ease-out ${
          mode === 'collector'
            ? 'left-1 right-[calc(50%+2px)]'
            : 'left-[calc(50%+2px)] right-1'
        }`}
      />

      {/* 收集器按钮 */}
      <button
        onClick={() => onModeChange('collector')}
        className={`relative z-10 flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
          mode === 'collector'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Layers className="h-4 w-4" />
        <span>{collectorLabel}</span>
      </button>

      {/* 工作区按钮 */}
      <button
        onClick={() => onModeChange('workspace')}
        className={`relative z-10 flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
          mode === 'workspace'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <FolderOpen className="h-4 w-4" />
        <span>{workspaceLabel}</span>
      </button>
    </div>
  );
}
