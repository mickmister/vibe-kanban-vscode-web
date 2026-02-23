import '@vitejs/plugin-react/preamble';
import './styles';

import React from 'react';
import springboard from 'springboard';
import { createDefaultWorkspace } from './types';
import type { WorkspaceState } from './types';

// @platform "browser"
import { HeroUIProvider } from '@heroui/react';
import { WorkspaceShell } from './components/WorkspaceShell';
import { useSessionWorkspaceNav } from './sessionState';
// @platform end

console.log('outside of module')
springboard.registerModule('workspace', {rpcMode: 'remote'}, async (moduleAPI) => {
  console.log('inside of module')

  const workspaceState = await moduleAPI.statesAPI.createPersistentState<WorkspaceState>(
    'workspace',
    createDefaultWorkspace()
  );

  const actions = moduleAPI.createActions({
    addSpace: async (args: { name: string }) => {
      return workspaceState.setStateImmer((draft) => {
        const id = `space_${draft.nextId++}`;
        const tgId = `tg_${draft.nextId++}`;

        draft.tabGroups.push({
          id: tgId,
          label: 'Main',
          tabs: [],
          pairs: [],
          order: 0,
        });

        draft.spaces.push({
          id,
          name: args.name,
          icon: 'default',
          tabGroupIds: [tgId],
        });

        return { spaceId: id, tabGroupId: tgId };
      });
    },

    deleteSpace: async (args: { spaceId: string }) => {
      return workspaceState.setStateImmer((draft) => {
        const idx = draft.spaces.findIndex((s) => s.id === args.spaceId);
        if (idx === -1 || draft.spaces.length <= 1) return { wasDeleted: false };

        const space = draft.spaces[idx];
        draft.tabGroups = draft.tabGroups.filter(
          (tg) => !space.tabGroupIds.includes(tg.id)
        );
        draft.spaces.splice(idx, 1);

        return { wasDeleted: true, deletedSpaceId: args.spaceId };
      });
    },

    renameSpace: async (args: { spaceId: string; name: string }) => {
      workspaceState.setStateImmer((draft) => {
        const space = draft.spaces.find((s) => s.id === args.spaceId);
        if (space) space.name = args.name;
      });
    },


    closeTab: async (args: { tabGroupId: string; tabId: string }) => {
      workspaceState.setStateImmer((draft) => {
        const tg = draft.tabGroups.find((g) => g.id === args.tabGroupId);
        if (!tg) return;

        const tab = tg.tabs.find((t) => t.id === args.tabId);
        if (tab?.pinned) return;

        tg.pairs = tg.pairs.filter((p) => !p.tabIds.includes(args.tabId));
        tg.tabs = tg.tabs.filter((t) => t.id !== args.tabId);
      });
    },

    addTab: async (args: { tabGroupId: string; title: string; url: string }) => {
      return workspaceState.setStateImmer((draft) => {
        const tg = draft.tabGroups.find((g) => g.id === args.tabGroupId);
        if (!tg) return;

        const tabId = `tab_${draft.nextId++}`;
        tg.tabs.push({ id: tabId, title: args.title, url: args.url });
        return { tabId, tabGroupId: args.tabGroupId };
      });
    },

    createPair: async (args: { tabGroupId: string; tabIds: string[] }) => {
      return workspaceState.setStateImmer((draft) => {
        const tg = draft.tabGroups.find((g) => g.id === args.tabGroupId);
        if (!tg) return;

        const pairId = `pair_${draft.nextId++}`;
        const ratios = args.tabIds.map(() => 100 / args.tabIds.length);
        tg.pairs.push({ id: pairId, tabIds: args.tabIds, ratios });
        return { pairId, tabGroupId: args.tabGroupId };
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

    reorderTabGroups: async (args: { sourceId: string; targetId: string; activeSpaceId: string }) => {
      workspaceState.setStateImmer((draft) => {
        const space = draft.spaces.find((s) => s.id === args.activeSpaceId);
        if (!space) return;

        const ids = space.tabGroupIds;
        const srcIdx = ids.indexOf(args.sourceId);
        const tgtIdx = ids.indexOf(args.targetId);
        if (srcIdx === -1 || tgtIdx === -1) return;

        ids.splice(srcIdx, 1);
        ids.splice(tgtIdx, 0, args.sourceId);
      });
    },

    closeActiveTab: async (args: { activeTabGroupId: string; activeItemId: string }) => {
      const state = workspaceState.getState();
      const tg = state.tabGroups.find((g) => g.id === args.activeTabGroupId);
      if (!tg) return;

      // Check if it's a pair - if so, return first tab ID to select
      const activePair = tg.pairs.find((p) => p.id === args.activeItemId);
      if (activePair) {
        return { selectTabId: tg.tabs[0]?.id };
      }

      // Otherwise close active tab (if not pinned)
      const activeTab = tg.tabs.find((t) => t.id === args.activeItemId);
      if (activeTab && !activeTab.pinned) {
        const tabIdx = tg.tabs.findIndex((t) => t.id === activeTab.id);
        const nextTabId = tg.tabs[Math.max(0, tabIdx - 1)]?.id;

        workspaceState.setStateImmer((draft) => {
          const dtg = draft.tabGroups.find((g) => g.id === args.activeTabGroupId);
          if (!dtg) return;

          dtg.pairs = dtg.pairs.filter((p) => !p.tabIds.includes(activeTab.id));
          dtg.tabs = dtg.tabs.filter((t) => t.id !== activeTab.id);
        });

        return { selectTabId: nextTabId };
      }
    },
  });

  moduleAPI.registerRoute('/', { hideApplicationShell: true }, () => {
    const workspace = workspaceState.useState();
    const sessionNav = useSessionWorkspaceNav(workspace);

    // Wrap actions that need session parameters
    const wrappedActions = {
      ...actions,
      reorderTabGroups: (args: { sourceId: string; targetId: string }) => {
        actions.reorderTabGroups({ ...args, activeSpaceId: sessionNav.activeSpaceId });
      },
      closeActiveTab: async () => {
        const activeItemId = sessionNav.getActiveItem(sessionNav.activeTabGroupId);
        const result = await actions.closeActiveTab({
          activeTabGroupId: sessionNav.activeTabGroupId,
          activeItemId,
        });
        // If action returned a tab to select, select it
        if (result?.selectTabId) {
          sessionNav.selectTab(sessionNav.activeTabGroupId, result.selectTabId);
        }
      },
      addTab: async (args: { tabGroupId: string; title: string; url: string }) => {
        const result = await actions.addTab(args);
        // Auto-select the newly added tab
        if (result?.tabId) {
          sessionNav.selectTab(result.tabGroupId, result.tabId);
        }
      },
      createPair: async (args: { tabGroupId: string; tabIds: string[] }) => {
        const result = await actions.createPair(args);
        // Auto-select the newly created pair
        if (result?.pairId) {
          sessionNav.selectPair(result.tabGroupId, result.pairId);
        }
      },
    };

    const sessionActions = {
      selectSpace: sessionNav.selectSpace,
      selectTab: sessionNav.selectTab,
      selectPair: sessionNav.selectPair,
      setActiveTabGroup: sessionNav.setActiveTabGroup,
    };

    return (
      <>
        <div className="dark w-screen h-screen fixed inset-0">
          <WorkspaceShell
            workspace={workspace}
            session={sessionNav}
            actions={wrappedActions}
            sessionActions={sessionActions}
          />
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
