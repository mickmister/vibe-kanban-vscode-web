import React, { useState } from 'react';
import { WorkspaceShell, type WorkspaceActions, type SessionActions } from './WorkspaceShell';
import type { WorkspaceState } from '../types';
import type { SessionWorkspaceNav } from '../sessionState';

interface WorkspaceShellContainerProps {
  initialWorkspace?: WorkspaceState;
}

export function WorkspaceShellContainer({ initialWorkspace }: WorkspaceShellContainerProps) {
  const [workspace, setWorkspace] = useState<WorkspaceState>(
    initialWorkspace || createDefaultWorkspace()
  );
  const [session, setSession] = useState<SessionWorkspaceNav>({
    activeSpaceId: workspace.spaces[0]?.id || '',
    activeTabGroupId: workspace.spaces[0]?.tabGroupIds[0] || '',
  });

  const actions: WorkspaceActions = {
    addSpace: async ({ name }) => {
      const newSpaceId = `space_${workspace.nextId}`;
      const newTabGroupId = `tg_${workspace.nextId + 1}`;

      setWorkspace((prev) => ({
        ...prev,
        nextId: prev.nextId + 2,
        spaces: [
          ...prev.spaces,
          {
            id: newSpaceId,
            name,
            icon: 'folder',
            tabGroupIds: [newTabGroupId],
          },
        ],
        tabGroups: [
          ...prev.tabGroups,
          {
            id: newTabGroupId,
            label: 'Main',
            activeItemId: '',
            tabs: [],
            pairs: [],
            order: 0,
          },
        ],
      }));

      return { spaceId: newSpaceId, tabGroupId: newTabGroupId };
    },

    deleteSpace: async ({ spaceId }) => {
      const space = workspace.spaces.find((s) => s.id === spaceId);
      if (!space || workspace.spaces.length <= 1) {
        return { wasDeleted: false };
      }

      setWorkspace((prev) => {
        const remainingTabGroups = prev.tabGroups.filter(
          (tg) => !space.tabGroupIds.includes(tg.id)
        );
        const remainingSpaces = prev.spaces.filter((s) => s.id !== spaceId);

        return {
          ...prev,
          spaces: remainingSpaces,
          tabGroups: remainingTabGroups,
        };
      });

      return { wasDeleted: true, deletedSpaceId: spaceId };
    },

    renameSpace: ({ spaceId, name }) => {
      setWorkspace((prev) => ({
        ...prev,
        spaces: prev.spaces.map((s) =>
          s.id === spaceId ? { ...s, name } : s
        ),
      }));
    },

    closeTab: ({ tabGroupId, tabId }) => {
      setWorkspace((prev) => {
        const tabGroup = prev.tabGroups.find((tg) => tg.id === tabGroupId);
        if (!tabGroup) return prev;

        const tab = tabGroup.tabs.find((t) => t.id === tabId);
        if (tab?.pinned) {
          console.warn('Cannot close pinned tab');
          return prev;
        }

        const newTabs = tabGroup.tabs.filter((t) => t.id !== tabId);
        const newPairs = tabGroup.pairs.filter(
          (p) => !p.tabIds.includes(tabId)
        );

        let newActiveItemId = tabGroup.activeItemId;
        if (tabGroup.activeItemId === tabId && newTabs.length > 0) {
          newActiveItemId = newTabs[0].id;
        }

        return {
          ...prev,
          tabGroups: prev.tabGroups.map((tg) =>
            tg.id === tabGroupId
              ? { ...tg, tabs: newTabs, pairs: newPairs, activeItemId: newActiveItemId }
              : tg
          ),
        };
      });
    },

    addTab: ({ tabGroupId, title, url }) => {
      setWorkspace((prev) => {
        const newTabId = `tab_${prev.nextId}`;
        return {
          ...prev,
          nextId: prev.nextId + 1,
          tabGroups: prev.tabGroups.map((tg) =>
            tg.id === tabGroupId
              ? {
                  ...tg,
                  tabs: [...tg.tabs, { id: newTabId, title, url }],
                  activeItemId: newTabId,
                }
              : tg
          ),
        };
      });
    },

    createPair: ({ tabGroupId, tabIds }) => {
      setWorkspace((prev) => {
        const newPairId = `pair_${prev.nextId}`;
        return {
          ...prev,
          nextId: prev.nextId + 1,
          tabGroups: prev.tabGroups.map((tg) =>
            tg.id === tabGroupId
              ? {
                  ...tg,
                  pairs: [
                    ...tg.pairs,
                    { id: newPairId, tabIds, ratios: tabIds.map(() => 100 / tabIds.length) },
                  ],
                  activeItemId: newPairId,
                }
              : tg
          ),
        };
      });
    },

    updatePairRatios: ({ tabGroupId, pairId, ratios }) => {
      setWorkspace((prev) => ({
        ...prev,
        tabGroups: prev.tabGroups.map((tg) =>
          tg.id === tabGroupId
            ? {
                ...tg,
                pairs: tg.pairs.map((p) =>
                  p.id === pairId ? { ...p, ratios } : p
                ),
              }
            : tg
        ),
      }));
    },

    reorderTabGroups: ({ sourceId, targetId }) => {
      setWorkspace((prev) => {
        const activeSpace = prev.spaces.find((s) => s.id === session.activeSpaceId);
        if (!activeSpace) return prev;

        const tabGroupIds = [...activeSpace.tabGroupIds];
        const sourceIdx = tabGroupIds.indexOf(sourceId);
        const targetIdx = tabGroupIds.indexOf(targetId);

        if (sourceIdx === -1 || targetIdx === -1) return prev;

        tabGroupIds.splice(sourceIdx, 1);
        tabGroupIds.splice(targetIdx, 0, sourceId);

        return {
          ...prev,
          spaces: prev.spaces.map((s) =>
            s.id === session.activeSpaceId ? { ...s, tabGroupIds } : s
          ),
        };
      });
    },

    closeActiveTab: () => {
      const activeTabGroup = workspace.tabGroups.find(
        (tg) => tg.id === session.activeTabGroupId
      );
      if (!activeTabGroup) return;

      const activeItem = activeTabGroup.activeItemId;

      // Check if it's a pair - if so, just select first tab
      const pair = activeTabGroup.pairs.find((p) => p.id === activeItem);
      if (pair) {
        setWorkspace((prev) => ({
          ...prev,
          tabGroups: prev.tabGroups.map((tg) =>
            tg.id === session.activeTabGroupId && tg.tabs.length > 0
              ? { ...tg, activeItemId: tg.tabs[0].id }
              : tg
          ),
        }));
        return;
      }

      // Otherwise close active tab (if not pinned)
      const tab = activeTabGroup.tabs.find((t) => t.id === activeItem);
      if (tab && !tab.pinned) {
        setWorkspace((prev) => {
          const tabGroup = prev.tabGroups.find((tg) => tg.id === session.activeTabGroupId);
          if (!tabGroup) return prev;

          const newTabs = tabGroup.tabs.filter((t) => t.id !== activeItem);
          const newPairs = tabGroup.pairs.filter((p) => !p.tabIds.includes(activeItem));
          const tabIdx = tabGroup.tabs.findIndex((t) => t.id === activeItem);
          const newActiveItemId = newTabs[Math.max(0, tabIdx - 1)]?.id || '';

          return {
            ...prev,
            tabGroups: prev.tabGroups.map((tg) =>
              tg.id === session.activeTabGroupId
                ? { ...tg, tabs: newTabs, pairs: newPairs, activeItemId: newActiveItemId }
                : tg
            ),
          };
        });
      }
    },
  };

  const sessionActions: SessionActions = {
    selectSpace: (spaceId) => {
      const space = workspace.spaces.find((s) => s.id === spaceId);
      if (!space) return;

      const firstTabGroupId = space.tabGroupIds[0];
      if (firstTabGroupId) {
        setSession({
          activeSpaceId: spaceId,
          activeTabGroupId: firstTabGroupId,
        });
      }
    },

    selectTab: (tabGroupId, tabId) => {
      setWorkspace((prev) => ({
        ...prev,
        tabGroups: prev.tabGroups.map((tg) =>
          tg.id === tabGroupId ? { ...tg, activeItemId: tabId } : tg
        ),
      }));
      setSession((prev) => ({
        ...prev,
        activeTabGroupId: tabGroupId,
      }));
    },

    selectPair: (tabGroupId, pairId) => {
      setWorkspace((prev) => ({
        ...prev,
        tabGroups: prev.tabGroups.map((tg) =>
          tg.id === tabGroupId ? { ...tg, activeItemId: pairId } : tg
        ),
      }));
      setSession((prev) => ({
        ...prev,
        activeTabGroupId: tabGroupId,
      }));
    },

    setActiveTabGroup: (tabGroupId) => {
      setSession((prev) => ({
        ...prev,
        activeTabGroupId: tabGroupId,
      }));
    },
  };

  return (
    <WorkspaceShell
      workspace={workspace}
      session={session}
      actions={actions}
      sessionActions={sessionActions}
    />
  );
}

function createDefaultWorkspace(): WorkspaceState {
  return {
    spaces: [
      {
        id: 'space_1',
        name: 'Dev',
        icon: 'code',
        tabGroupIds: ['tg_1'],
      },
    ],
    tabGroups: [
      {
        id: 'tg_1',
        label: 'Editor',
        activeItemId: '',
        tabs: [],
        pairs: [],
        order: 0,
      },
    ],
    nextId: 10,
  };
}
