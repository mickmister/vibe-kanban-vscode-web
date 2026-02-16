export interface Tab {
  id: string;
  title: string;
  url: string;
  /** If true, this tab is pinned and cannot be closed */
  pinned?: boolean;
}

export interface TabPair {
  id: string;
  /** Tab IDs in this pair, rendered side-by-side */
  tabIds: string[];
  /** Flex ratios for each tab (e.g., [3, 1] for 75%/25% split) */
  ratios: number[];
}

export interface TabGroup {
  id: string;
  label: string;
  /** Active tab or pair ID being displayed */
  activeItemId: string;
  /** All tabs in this group */
  tabs: Tab[];
  /** Tab pairs (split views) */
  pairs: TabPair[];
  /** Display order within the space */
  order: number;
}

export interface Space {
  id: string;
  name: string;
  icon: string;
  /** Tab group IDs belonging to this space */
  tabGroupIds: string[];
}

export interface WorkspaceState {
  spaces: Space[];
  tabGroups: TabGroup[];
  activeSpaceId: string;
  /** Active tab group within the current space */
  activeTabGroupId: string;
  /** Counter for generating unique IDs */
  nextId: number;
}

export function generateId(state: WorkspaceState, prefix: string): string {
  return `${prefix}_${state.nextId}`;
}

export function createDefaultWorkspace(): WorkspaceState {
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
            url: 'https://jamtools.dev/?folder=/var/tmp/vibe-kanban/worktrees/6c2d-vk-wrapper-app/vibe-kanban-vscode-web',
            pinned: true,
          },
          {
            id: 'tab_2',
            title: 'Kanban',
            url: 'https://jamtools.dev/workspaces/6c2d379f-71b7-4884-a1f7-7e431e2257fe',
            pinned: false,
          },
        ],
        pairs: [
          {
            id: 'pair_1',
            tabIds: ['tab_1', 'tab_2'],
            ratios: [3, 1],
          },
        ],
        order: 0,
      },
    ],
    activeSpaceId: 'space_1',
    activeTabGroupId: 'tg_1',
    nextId: 10,
  };
}
