import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { IframePanel } from './IframePanel';
import { AddTabModal } from './AddTabModal';
import type {
  WorkspaceState,
  Space,
  TabGroup,
  Tab,
  TabPair,
} from '../types';

type StateSupervisor<T> = {
  useState: () => T;
  getState: () => T;
  setState: (val: T | ((prev: T) => T)) => void;
  setStateImmer: (fn: (draft: T) => void) => void;
};

interface WorkspaceShellProps {
  workspaceState: StateSupervisor<WorkspaceState>;
}

export function WorkspaceShell({ workspaceState }: WorkspaceShellProps) {
  const workspace = workspaceState.useState();
  const [addTabModalOpen, setAddTabModalOpen] = useState(false);
  const [addTabTargetGroupId, setAddTabTargetGroupId] = useState<string>('');
  const dragGroupRef = useRef<string | null>(null);

  // --- Space actions ---
  const selectSpace = useCallback(
    (spaceId: string) => {
      workspaceState.setStateImmer((draft) => {
        draft.activeSpaceId = spaceId;
        const space = draft.spaces.find((s) => s.id === spaceId);
        if (space && space.tabGroupIds.length > 0) {
          draft.activeTabGroupId = space.tabGroupIds[0];
        }
      });
    },
    [workspaceState]
  );

  const addSpace = useCallback(
    (name: string) => {
      workspaceState.setStateImmer((draft) => {
        const id = `space_${draft.nextId++}`;
        const tgId = `tg_${draft.nextId++}`;
        const tabId = `tab_${draft.nextId++}`;

        draft.tabGroups.push({
          id: tgId,
          label: 'Main',
          activeItemId: tabId,
          tabs: [
            {
              id: tabId,
              title: 'New Tab',
              url: 'https://jamtools.dev/',
            },
          ],
          pairs: [],
          order: 0,
        });

        draft.spaces.push({
          id,
          name,
          icon: 'default',
          tabGroupIds: [tgId],
        });

        draft.activeSpaceId = id;
        draft.activeTabGroupId = tgId;
      });
    },
    [workspaceState]
  );

  const deleteSpace = useCallback(
    (spaceId: string) => {
      workspaceState.setStateImmer((draft) => {
        const idx = draft.spaces.findIndex((s) => s.id === spaceId);
        if (idx === -1 || draft.spaces.length <= 1) return;

        const space = draft.spaces[idx];
        // Remove associated tab groups
        draft.tabGroups = draft.tabGroups.filter(
          (tg) => !space.tabGroupIds.includes(tg.id)
        );
        draft.spaces.splice(idx, 1);

        if (draft.activeSpaceId === spaceId) {
          draft.activeSpaceId = draft.spaces[0].id;
          const newSpace = draft.spaces[0];
          draft.activeTabGroupId =
            newSpace.tabGroupIds[0] || '';
        }
      });
    },
    [workspaceState]
  );

  const renameSpace = useCallback(
    (spaceId: string, name: string) => {
      workspaceState.setStateImmer((draft) => {
        const space = draft.spaces.find((s) => s.id === spaceId);
        if (space) space.name = name;
      });
    },
    [workspaceState]
  );

  // --- Tab group actions ---
  const selectTab = useCallback(
    (tabGroupId: string, tabId: string) => {
      workspaceState.setStateImmer((draft) => {
        const tg = draft.tabGroups.find((g) => g.id === tabGroupId);
        if (tg) tg.activeItemId = tabId;
        draft.activeTabGroupId = tabGroupId;
      });
    },
    [workspaceState]
  );

  const selectPair = useCallback(
    (tabGroupId: string, pairId: string) => {
      workspaceState.setStateImmer((draft) => {
        const tg = draft.tabGroups.find((g) => g.id === tabGroupId);
        if (tg) tg.activeItemId = pairId;
        draft.activeTabGroupId = tabGroupId;
      });
    },
    [workspaceState]
  );

  const closeTab = useCallback(
    (tabGroupId: string, tabId: string) => {
      workspaceState.setStateImmer((draft) => {
        const tg = draft.tabGroups.find((g) => g.id === tabGroupId);
        if (!tg) return;

        const tab = tg.tabs.find((t) => t.id === tabId);
        if (tab?.pinned) return;

        // Remove from pairs
        tg.pairs = tg.pairs.filter((p) => !p.tabIds.includes(tabId));

        // Remove tab
        const tabIdx = tg.tabs.findIndex((t) => t.id === tabId);
        tg.tabs.splice(tabIdx, 1);

        // Update active if needed
        if (tg.activeItemId === tabId && tg.tabs.length > 0) {
          tg.activeItemId = tg.tabs[Math.max(0, tabIdx - 1)].id;
        }
      });
    },
    [workspaceState]
  );

  const openAddTabModal = useCallback((tabGroupId: string) => {
    setAddTabTargetGroupId(tabGroupId);
    setAddTabModalOpen(true);
  }, []);

  const addTab = useCallback(
    (title: string, url: string) => {
      workspaceState.setStateImmer((draft) => {
        const tg = draft.tabGroups.find(
          (g) => g.id === addTabTargetGroupId
        );
        if (!tg) return;

        const tabId = `tab_${draft.nextId++}`;
        tg.tabs.push({ id: tabId, title, url });
        tg.activeItemId = tabId;
      });
    },
    [workspaceState, addTabTargetGroupId]
  );

  const createPair = useCallback(
    (tabGroupId: string, tabIds: string[]) => {
      workspaceState.setStateImmer((draft) => {
        const tg = draft.tabGroups.find((g) => g.id === tabGroupId);
        if (!tg) return;

        const pairId = `pair_${draft.nextId++}`;
        const ratios = tabIds.map(() => 1);
        tg.pairs.push({ id: pairId, tabIds, ratios });
        tg.activeItemId = pairId;
      });
    },
    [workspaceState]
  );

  const updatePairRatios = useCallback(
    (tabGroupId: string, pairId: string, ratios: number[]) => {
      workspaceState.setStateImmer((draft) => {
        const tg = draft.tabGroups.find((g) => g.id === tabGroupId);
        if (!tg) return;
        const pair = tg.pairs.find((p) => p.id === pairId);
        if (pair) pair.ratios = ratios;
      });
    },
    [workspaceState]
  );

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

      workspaceState.setStateImmer((draft) => {
        const space = draft.spaces.find(
          (s) => s.id === draft.activeSpaceId
        );
        if (!space) return;

        const ids = space.tabGroupIds;
        const srcIdx = ids.indexOf(sourceId);
        const tgtIdx = ids.indexOf(targetGroupId);
        if (srcIdx === -1 || tgtIdx === -1) return;

        ids.splice(srcIdx, 1);
        ids.splice(tgtIdx, 0, sourceId);
      });

      dragGroupRef.current = null;
    },
    [workspaceState]
  );

  // --- Cmd+W handler ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault();
        e.stopPropagation();

        const state = workspaceState.getState();
        const tg = state.tabGroups.find(
          (g) => g.id === state.activeTabGroupId
        );
        if (!tg) return;

        // If a pair is active, deactivate it and select first tab
        const activePair = tg.pairs.find(
          (p) => p.id === tg.activeItemId
        );
        if (activePair) {
          workspaceState.setStateImmer((draft) => {
            const dtg = draft.tabGroups.find(
              (g) => g.id === draft.activeTabGroupId
            );
            if (dtg && dtg.tabs.length > 0) {
              dtg.activeItemId = dtg.tabs[0].id;
            }
          });
          return;
        }

        // Otherwise close active tab (if not pinned)
        const activeTab = tg.tabs.find(
          (t) => t.id === tg.activeItemId
        );
        if (activeTab && !activeTab.pinned) {
          closeTab(tg.id, activeTab.id);
        }
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () =>
      window.removeEventListener('keydown', handler, { capture: true });
  }, [workspaceState, closeTab]);

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
        onSelectSpace={selectSpace}
        onAddSpace={addSpace}
        onDeleteSpace={deleteSpace}
        onRenameSpace={renameSpace}
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
              className={`flex flex-col min-h-0 ${
                activeTabGroups.length > 1 ? 'flex-1' : 'flex-1'
              } ${
                workspace.activeTabGroupId === tg.id
                  ? 'ring-1 ring-primary-500/30'
                  : ''
              }`}
              onClick={() => {
                workspaceState.setStateImmer((draft) => {
                  draft.activeTabGroupId = tg.id;
                });
              }}
            >
              <TabBar
                tabGroup={tg}
                onSelectTab={(tabId) => selectTab(tg.id, tabId)}
                onSelectPair={(pairId) =>
                  selectPair(tg.id, pairId)
                }
                onCloseTab={(tabId) => closeTab(tg.id, tabId)}
                onAddTab={() => openAddTabModal(tg.id)}
                onCreatePair={(tabIds) =>
                  createPair(tg.id, tabIds)
                }
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
              <IframePanel
                tabGroup={tg}
                onUpdatePairRatios={(pairId, ratios) =>
                  updatePairRatios(tg.id, pairId, ratios)
                }
              />
            </div>
          ))
        )}
      </div>

      <AddTabModal
        isOpen={addTabModalOpen}
        onClose={() => setAddTabModalOpen(false)}
        onAdd={addTab}
      />
    </div>
  );
}
