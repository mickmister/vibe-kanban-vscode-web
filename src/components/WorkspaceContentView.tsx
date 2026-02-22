import React from 'react';
import { UnifiedTabView } from './UnifiedTabView';
import type { TabGroup } from '../types';
import type { WorkspaceActions } from './WorkspaceShell';

interface WorkspaceContentViewProps {
  activeTabGroups: TabGroup[];
  activeTabGroupId: string;
  actions: WorkspaceActions;
  onOpenAddTabModal: (tabGroupId: string) => void;
  onDragStart: (e: React.DragEvent, tabGroupId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetGroupId: string) => void;
}

export function WorkspaceContentView({
  activeTabGroups,
  activeTabGroupId,
  actions,
  onOpenAddTabModal,
  onDragStart,
  onDragOver,
  onDrop,
}: WorkspaceContentViewProps) {
  if (activeTabGroups.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-500">
        <p>
          No tab groups in this space. Hover left to switch spaces.
        </p>
      </div>
    );
  }

  return (
    <UnifiedTabView
      tabGroups={activeTabGroups}
      activeTabGroupId={activeTabGroupId}
      actions={actions}
      onOpenAddTabModal={onOpenAddTabModal}
    />
  );
}
