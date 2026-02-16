import './styles.css';

import React from 'react';
import { HeroUIProvider } from '@heroui/react';
import springboard from 'springboard';
import { WorkspaceShell } from './components/WorkspaceShell';
import { createDefaultWorkspace } from './types';
import type { WorkspaceState } from './types';

springboard.registerModule('workspace', {}, async (moduleAPI) => {
  const workspaceState = await moduleAPI.statesAPI.createPersistentState<WorkspaceState>(
    'workspace',
    createDefaultWorkspace()
  );

  const actions = moduleAPI.createActions({
    selectSpace: async (args: { spaceId: string }) => {
      workspaceState.setStateImmer((draft) => {
        draft.activeSpaceId = args.spaceId;
        const space = draft.spaces.find((s) => s.id === args.spaceId);
        if (space && space.tabGroupIds.length > 0) {
          draft.activeTabGroupId = space.tabGroupIds[0];
        }
      });
    },

    addSpace: async (args: { name: string }) => {
      workspaceState.setStateImmer((draft) => {
        const id = `space_${draft.nextId++}`;
        const tgId = `tg_${draft.nextId++}`;
        const tabId = `tab_${draft.nextId++}`;

        draft.tabGroups.push({
          id: tgId,
          label: 'Main',
          activeItemId: tabId,
          tabs: [{ id: tabId, title: 'New Tab', url: 'https://jamtools.dev/' }],
          pairs: [],
          order: 0,
        });

        draft.spaces.push({
          id,
          name: args.name,
          icon: 'default',
          tabGroupIds: [tgId],
        });

        draft.activeSpaceId = id;
        draft.activeTabGroupId = tgId;
      });
    },

    deleteSpace: async (args: { spaceId: string }) => {
      workspaceState.setStateImmer((draft) => {
        const idx = draft.spaces.findIndex((s) => s.id === args.spaceId);
        if (idx === -1 || draft.spaces.length <= 1) return;

        const space = draft.spaces[idx];
        draft.tabGroups = draft.tabGroups.filter(
          (tg) => !space.tabGroupIds.includes(tg.id)
        );
        draft.spaces.splice(idx, 1);

        if (draft.activeSpaceId === args.spaceId) {
          draft.activeSpaceId = draft.spaces[0].id;
          draft.activeTabGroupId = draft.spaces[0].tabGroupIds[0] || '';
        }
      });
    },

    renameSpace: async (args: { spaceId: string; name: string }) => {
      workspaceState.setStateImmer((draft) => {
        const space = draft.spaces.find((s) => s.id === args.spaceId);
        if (space) space.name = args.name;
      });
    },

    selectTab: async (args: { tabGroupId: string; tabId: string }) => {
      workspaceState.setStateImmer((draft) => {
        const tg = draft.tabGroups.find((g) => g.id === args.tabGroupId);
        if (tg) tg.activeItemId = args.tabId;
        draft.activeTabGroupId = args.tabGroupId;
      });
    },

    selectPair: async (args: { tabGroupId: string; pairId: string }) => {
      workspaceState.setStateImmer((draft) => {
        const tg = draft.tabGroups.find((g) => g.id === args.tabGroupId);
        if (tg) tg.activeItemId = args.pairId;
        draft.activeTabGroupId = args.tabGroupId;
      });
    },

    setActiveTabGroup: async (args: { tabGroupId: string }) => {
      workspaceState.setStateImmer((draft) => {
        draft.activeTabGroupId = args.tabGroupId;
      });
    },

    closeTab: async (args: { tabGroupId: string; tabId: string }) => {
      workspaceState.setStateImmer((draft) => {
        const tg = draft.tabGroups.find((g) => g.id === args.tabGroupId);
        if (!tg) return;

        const tab = tg.tabs.find((t) => t.id === args.tabId);
        if (tab?.pinned) return;

        tg.pairs = tg.pairs.filter((p) => !p.tabIds.includes(args.tabId));

        const tabIdx = tg.tabs.findIndex((t) => t.id === args.tabId);
        tg.tabs.splice(tabIdx, 1);

        if (tg.activeItemId === args.tabId && tg.tabs.length > 0) {
          tg.activeItemId = tg.tabs[Math.max(0, tabIdx - 1)].id;
        }
      });
    },

    addTab: async (args: { tabGroupId: string; title: string; url: string }) => {
      workspaceState.setStateImmer((draft) => {
        const tg = draft.tabGroups.find((g) => g.id === args.tabGroupId);
        if (!tg) return;

        const tabId = `tab_${draft.nextId++}`;
        tg.tabs.push({ id: tabId, title: args.title, url: args.url });
        tg.activeItemId = tabId;
      });
    },

    createPair: async (args: { tabGroupId: string; tabIds: string[] }) => {
      workspaceState.setStateImmer((draft) => {
        const tg = draft.tabGroups.find((g) => g.id === args.tabGroupId);
        if (!tg) return;

        const pairId = `pair_${draft.nextId++}`;
        const ratios = args.tabIds.map(() => 1);
        tg.pairs.push({ id: pairId, tabIds: args.tabIds, ratios });
        tg.activeItemId = pairId;
      });
    },

    updatePairRatios: async (args: { tabGroupId: string; pairId: string; ratios: number[] }) => {
      workspaceState.setStateImmer((draft) => {
        const tg = draft.tabGroups.find((g) => g.id === args.tabGroupId);
        if (!tg) return;
        const pair = tg.pairs.find((p) => p.id === args.pairId);
        if (pair) pair.ratios = args.ratios;
      });
    },

    reorderTabGroups: async (args: { sourceId: string; targetId: string }) => {
      workspaceState.setStateImmer((draft) => {
        const space = draft.spaces.find((s) => s.id === draft.activeSpaceId);
        if (!space) return;

        const ids = space.tabGroupIds;
        const srcIdx = ids.indexOf(args.sourceId);
        const tgtIdx = ids.indexOf(args.targetId);
        if (srcIdx === -1 || tgtIdx === -1) return;

        ids.splice(srcIdx, 1);
        ids.splice(tgtIdx, 0, args.sourceId);
      });
    },

    closeActiveTab: async (_args: Record<string, never>) => {
      const state = workspaceState.getState();
      const tg = state.tabGroups.find((g) => g.id === state.activeTabGroupId);
      if (!tg) return;

      // If a pair is active, deactivate it and select first tab
      const activePair = tg.pairs.find((p) => p.id === tg.activeItemId);
      if (activePair) {
        workspaceState.setStateImmer((draft) => {
          const dtg = draft.tabGroups.find((g) => g.id === draft.activeTabGroupId);
          if (dtg && dtg.tabs.length > 0) {
            dtg.activeItemId = dtg.tabs[0].id;
          }
        });
        return;
      }

      // Otherwise close active tab (if not pinned)
      const activeTab = tg.tabs.find((t) => t.id === tg.activeItemId);
      if (activeTab && !activeTab.pinned) {
        workspaceState.setStateImmer((draft) => {
          const dtg = draft.tabGroups.find((g) => g.id === state.activeTabGroupId);
          if (!dtg) return;

          dtg.pairs = dtg.pairs.filter((p) => !p.tabIds.includes(activeTab.id));
          const tabIdx = dtg.tabs.findIndex((t) => t.id === activeTab.id);
          dtg.tabs.splice(tabIdx, 1);

          if (dtg.activeItemId === activeTab.id && dtg.tabs.length > 0) {
            dtg.activeItemId = dtg.tabs[Math.max(0, tabIdx - 1)].id;
          }
        });
      }
    },
  });

  moduleAPI.registerRoute('/', { hideApplicationShell: true }, () => {
    return (
      <>
        <div className="dark w-screen h-screen fixed inset-0">
          <WorkspaceShell workspaceState={workspaceState} actions={actions} />
        </div>
      </>
    );
  });

  return {
    states: { workspace: workspaceState },
    Provider: (props: React.PropsWithChildren) => {
      return (
        <HeroUIProvider>
          {props.children}
        </HeroUIProvider>
      );
    },
  };
});
