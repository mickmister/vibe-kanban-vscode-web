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
  /** Percentage sizes for each tab (e.g., [75, 25] for 75%/25% split) */
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
        activeItemId: '',
        tabs: [],
        pairs: [],
        order: 0,
      },
    ],
    activeSpaceId: 'space_1',
    activeTabGroupId: 'tg_1',
    nextId: 10,
  };
}
