import React, { useState, useCallback } from 'react';
import { WorkspaceShell, type WorkspaceActions } from './WorkspaceShell';
import type { WorkspaceState, Tab, TabPair, TabGroup } from '../types';

interface WorkspaceShellContainerProps {
  initialWorkspace?: WorkspaceState;
}

export function WorkspaceShellContainer({ initialWorkspace }: WorkspaceShellContainerProps) {
  const [workspace, setWorkspace] = useState<WorkspaceState>(
    initialWorkspace || createDefaultWorkspace()
  );

  const actions: WorkspaceActions = {
    selectSpace: useCallback(({ spaceId }) => {
      setWorkspace((prev) => ({
        ...prev,
        activeSpaceId: spaceId,
        // Set active tab group to first in the space
        activeTabGroupId: prev.spaces.find((s) => s.id === spaceId)?.tabGroupIds[0] || prev.activeTabGroupId,
      }));
    }, []),

    addSpace: useCallback(({ name }) => {
      setWorkspace((prev) => {
        const newSpaceId = `space_${prev.nextId}`;
        const newTabGroupId = `tg_${prev.nextId + 1}`;
        const newTabId = `tab_${prev.nextId + 2}`;

        return {
          ...prev,
          nextId: prev.nextId + 3,
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
              activeItemId: newTabId,
              tabs: [
                {
                  id: newTabId,
                  title: 'New Tab',
                  url: 'about:blank',
                },
              ],
              pairs: [],
              order: 0,
            },
          ],
          activeSpaceId: newSpaceId,
          activeTabGroupId: newTabGroupId,
        };
      });
    }, []),

    deleteSpace: useCallback(({ spaceId }) => {
      setWorkspace((prev) => {
        const space = prev.spaces.find((s) => s.id === spaceId);
        if (!space) return prev;

        // Remove tab groups belonging to this space
        const remainingTabGroups = prev.tabGroups.filter(
          (tg) => !space.tabGroupIds.includes(tg.id)
        );

        // Remove the space
        const remainingSpaces = prev.spaces.filter((s) => s.id !== spaceId);

        // If we deleted the active space, switch to first available
        const newActiveSpaceId =
          prev.activeSpaceId === spaceId
            ? remainingSpaces[0]?.id || ''
            : prev.activeSpaceId;

        const newActiveTabGroupId =
          prev.activeSpaceId === spaceId
            ? remainingSpaces[0]?.tabGroupIds[0] || ''
            : prev.activeTabGroupId;

        return {
          ...prev,
          spaces: remainingSpaces,
          tabGroups: remainingTabGroups,
          activeSpaceId: newActiveSpaceId,
          activeTabGroupId: newActiveTabGroupId,
        };
      });
    }, []),

    renameSpace: useCallback(({ spaceId, name }) => {
      setWorkspace((prev) => ({
        ...prev,
        spaces: prev.spaces.map((s) =>
          s.id === spaceId ? { ...s, name } : s
        ),
      }));
    }, []),

    selectTab: useCallback(({ tabGroupId, tabId }) => {
      setWorkspace((prev) => ({
        ...prev,
        tabGroups: prev.tabGroups.map((tg) =>
          tg.id === tabGroupId ? { ...tg, activeItemId: tabId } : tg
        ),
      }));
    }, []),

    selectPair: useCallback(({ tabGroupId, pairId }) => {
      setWorkspace((prev) => ({
        ...prev,
        tabGroups: prev.tabGroups.map((tg) =>
          tg.id === tabGroupId ? { ...tg, activeItemId: pairId } : tg
        ),
      }));
    }, []),

    setActiveTabGroup: useCallback(({ tabGroupId }) => {
      setWorkspace((prev) => ({
        ...prev,
        activeTabGroupId: tabGroupId,
      }));
    }, []),

    closeTab: useCallback(({ tabGroupId, tabId }) => {
      setWorkspace((prev) => {
        const tabGroup = prev.tabGroups.find((tg) => tg.id === tabGroupId);
        if (!tabGroup) return prev;

        const tab = tabGroup.tabs.find((t) => t.id === tabId);
        if (tab?.pinned) {
          console.warn('Cannot close pinned tab');
          return prev;
        }

        // Remove tab
        const newTabs = tabGroup.tabs.filter((t) => t.id !== tabId);

        // Remove pairs containing this tab
        const newPairs = tabGroup.pairs.filter(
          (p) => !p.tabIds.includes(tabId)
        );

        // If we closed the active tab, switch to first available
        let newActiveItemId = tabGroup.activeItemId;
        if (tabGroup.activeItemId === tabId) {
          newActiveItemId = newTabs[0]?.id || newPairs[0]?.id || '';
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
    }, []),

    addTab: useCallback(({ tabGroupId, title, url }) => {
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
    }, []),

    createPair: useCallback(({ tabGroupId, tabIds }) => {
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
                    { id: newPairId, tabIds, ratios: [1, 1] },
                  ],
                  activeItemId: newPairId,
                }
              : tg
          ),
        };
      });
    }, []),

    updatePairRatios: useCallback(({ tabGroupId, pairId, ratios }) => {
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
    }, []),

    reorderTabGroups: useCallback(({ sourceId, targetId }) => {
      setWorkspace((prev) => {
        const activeSpace = prev.spaces.find((s) => s.id === prev.activeSpaceId);
        if (!activeSpace) return prev;

        const tabGroupIds = [...activeSpace.tabGroupIds];
        const sourceIdx = tabGroupIds.indexOf(sourceId);
        const targetIdx = tabGroupIds.indexOf(targetId);

        if (sourceIdx === -1 || targetIdx === -1) return prev;

        // Reorder
        tabGroupIds.splice(sourceIdx, 1);
        tabGroupIds.splice(targetIdx, 0, sourceId);

        return {
          ...prev,
          spaces: prev.spaces.map((s) =>
            s.id === prev.activeSpaceId ? { ...s, tabGroupIds } : s
          ),
        };
      });
    }, []),

    closeActiveTab: useCallback(() => {
      setWorkspace((prev) => {
        const activeTabGroup = prev.tabGroups.find(
          (tg) => tg.id === prev.activeTabGroupId
        );
        if (!activeTabGroup) return prev;

        const activeItem = activeTabGroup.activeItemId;

        // Check if it's a tab
        const tab = activeTabGroup.tabs.find((t) => t.id === activeItem);
        if (tab) {
          if (tab.pinned) {
            console.warn('Cannot close pinned tab');
            return prev;
          }

          // Remove tab
          const newTabs = activeTabGroup.tabs.filter((t) => t.id !== activeItem);

          // Remove pairs containing this tab
          const newPairs = activeTabGroup.pairs.filter(
            (p) => !p.tabIds.includes(activeItem)
          );

          // Switch to first available
          const newActiveItemId = newTabs[0]?.id || newPairs[0]?.id || '';

          return {
            ...prev,
            tabGroups: prev.tabGroups.map((tg) =>
              tg.id === prev.activeTabGroupId
                ? { ...tg, tabs: newTabs, pairs: newPairs, activeItemId: newActiveItemId }
                : tg
            ),
          };
        }

        // Check if it's a pair
        const pair = activeTabGroup.pairs.find((p) => p.id === activeItem);
        if (pair) {
          // Remove the pair
          const newPairs = activeTabGroup.pairs.filter((p) => p.id !== activeItem);

          // Switch to first available
          const newActiveItemId =
            activeTabGroup.tabs[0]?.id || newPairs[0]?.id || '';

          return {
            ...prev,
            tabGroups: prev.tabGroups.map((tg) =>
              tg.id === prev.activeTabGroupId
                ? { ...tg, pairs: newPairs, activeItemId: newActiveItemId }
                : tg
            ),
          };
        }

        return prev;
      });
    }, []),
  };

  return <WorkspaceShell workspace={workspace} actions={actions} />;
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
        activeItemId: 'tab_1',
        tabs: [
          {
            id: 'tab_1',
            title: 'Code',
            url: 'https://jamtools.dev',
            pinned: true,
          },
          {
            id: 'tab_2',
            title: 'Kanban',
            url: 'https://jamtools.dev/workspaces',
            pinned: false,
          },
        ],
        pairs: [],
        order: 0,
      },
    ],
    activeSpaceId: 'space_1',
    activeTabGroupId: 'tg_1',
    nextId: 10,
  };
}
