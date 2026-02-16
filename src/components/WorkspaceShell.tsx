import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { IframePanel } from './IframePanel';
import { AddTabModal } from './AddTabModal';
import type { WorkspaceState, TabGroup } from '../types';

type StateSupervisor<T> = {
  useState: () => T;
  getState: () => T;
};

export type WorkspaceActions = {
  selectSpace: (args: { spaceId: string }) => Promise<void>;
  addSpace: (args: { name: string }) => Promise<void>;
  deleteSpace: (args: { spaceId: string }) => Promise<void>;
  renameSpace: (args: { spaceId: string; name: string }) => Promise<void>;
  selectTab: (args: { tabGroupId: string; tabId: string }) => Promise<void>;
  selectPair: (args: { tabGroupId: string; pairId: string }) => Promise<void>;
  setActiveTabGroup: (args: { tabGroupId: string }) => Promise<void>;
  closeTab: (args: { tabGroupId: string; tabId: string }) => Promise<void>;
  addTab: (args: { tabGroupId: string; title: string; url: string }) => Promise<void>;
  createPair: (args: { tabGroupId: string; tabIds: string[] }) => Promise<void>;
  updatePairRatios: (args: { tabGroupId: string; pairId: string; ratios: number[] }) => Promise<void>;
  reorderTabGroups: (args: { sourceId: string; targetId: string }) => Promise<void>;
  closeActiveTab: (args: Record<string, never>) => Promise<void>;
};

interface WorkspaceShellProps {
  workspaceState: StateSupervisor<WorkspaceState>;
  actions: WorkspaceActions;
}

export function WorkspaceShell({ workspaceState, actions }: WorkspaceShellProps) {
  const workspace = workspaceState.useState();
  const [addTabModalOpen, setAddTabModalOpen] = useState(false);
  const [addTabTargetGroupId, setAddTabTargetGroupId] = useState<string>('');
  const dragGroupRef = useRef<string | null>(null);

  // --- Drag-and-drop for tab groups ---
  const handleDragStart = useCallback(
    (e: React.DragEvent, tabGroupId: string) => {
      dragGroupRef.current = tabGroupId;
      e.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetGroupId: string) => {
      e.preventDefault();
      const sourceId = dragGroupRef.current;
      if (!sourceId || sourceId === targetGroupId) return;
      actions.reorderTabGroups({ sourceId, targetId: targetGroupId });
      dragGroupRef.current = null;
    },
    [actions]
  );

  // --- Cmd+W handler ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault();
        e.stopPropagation();
        actions.closeActiveTab({} as Record<string, never>);
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () =>
      window.removeEventListener('keydown', handler, { capture: true });
  }, [actions]);

  // --- Add tab modal handler ---
  const openAddTabModal = useCallback((tabGroupId: string) => {
    setAddTabTargetGroupId(tabGroupId);
    setAddTabModalOpen(true);
  }, []);

  const handleAddTab = useCallback(
    (title: string, url: string) => {
      actions.addTab({ tabGroupId: addTabTargetGroupId, title, url });
    },
    [actions, addTabTargetGroupId]
  );

  // --- Derived state ---
  const activeSpace = workspace.spaces.find(
    (s) => s.id === workspace.activeSpaceId
  );
  const activeTabGroups = activeSpace
    ? activeSpace.tabGroupIds
        .map((id) => workspace.tabGroups.find((tg) => tg.id === id))
        .filter((tg): tg is TabGroup => tg != null)
    : [];

  return (
    <div className="w-full h-full flex flex-col bg-neutral-950">
      <Sidebar
        workspace={workspace}
        onSelectSpace={(spaceId) => actions.selectSpace({ spaceId })}
        onAddSpace={(name) => actions.addSpace({ name })}
        onDeleteSpace={(spaceId) => actions.deleteSpace({ spaceId })}
        onRenameSpace={(spaceId, name) => actions.renameSpace({ spaceId, name })}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTabGroups.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-neutral-500">
            <p>
              No tab groups in this space. Hover left to switch spaces.
            </p>
          </div>
        ) : (
          activeTabGroups.map((tg) => (
            <div
              key={tg.id}
              className={`flex flex-col min-h-0 flex-1 ${
                workspace.activeTabGroupId === tg.id
                  ? 'ring-1 ring-primary-500/30'
                  : ''
              }`}
              onClick={() => actions.setActiveTabGroup({ tabGroupId: tg.id })}
            >
              <TabBar
                tabGroup={tg}
                onSelectTab={(tabId) => actions.selectTab({ tabGroupId: tg.id, tabId })}
                onSelectPair={(pairId) => actions.selectPair({ tabGroupId: tg.id, pairId })}
                onCloseTab={(tabId) => actions.closeTab({ tabGroupId: tg.id, tabId })}
                onAddTab={() => openAddTabModal(tg.id)}
                onCreatePair={(tabIds) => actions.createPair({ tabGroupId: tg.id, tabIds })}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
              <IframePanel
                tabGroup={tg}
                onUpdatePairRatios={(pairId, ratios) =>
                  actions.updatePairRatios({ tabGroupId: tg.id, pairId, ratios })
                }
              />
            </div>
          ))
        )}
      </div>

      <AddTabModal
        isOpen={addTabModalOpen}
        onClose={() => setAddTabModalOpen(false)}
        onAdd={handleAddTab}
      />
    </div>
  );
}
