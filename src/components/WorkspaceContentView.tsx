import React from 'react';
import { TabGroupPanel } from './TabGroupPanel';
import type { TabGroup, WorkspaceState } from '../types';
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
    <>
      {activeTabGroups.map((tg) => (
        <TabGroupPanel
          key={tg.id}
          tabGroup={tg}
          isActive={activeTabGroupId === tg.id}
          onSetActive={() => actions.setActiveTabGroup({ tabGroupId: tg.id })}
          onSelectTab={(tabId) => actions.selectTab({ tabGroupId: tg.id, tabId })}
          onSelectPair={(pairId) => actions.selectPair({ tabGroupId: tg.id, pairId })}
          onCloseTab={(tabId) => actions.closeTab({ tabGroupId: tg.id, tabId })}
          onAddTab={() => onOpenAddTabModal(tg.id)}
          onCreatePair={(tabIds) => actions.createPair({ tabGroupId: tg.id, tabIds })}
          onUpdatePairRatios={(pairId, ratios) =>
            actions.updatePairRatios({ tabGroupId: tg.id, pairId, ratios })
          }
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
        />
      ))}
    </>
  );
}
