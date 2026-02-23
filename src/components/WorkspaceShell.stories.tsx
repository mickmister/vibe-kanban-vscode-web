import type { Meta, StoryObj } from '@storybook/react';
import { WorkspaceShellContainer } from './WorkspaceShellContainer';
import type { WorkspaceState } from '../types';

const meta = {
  title: 'WorkspaceShell',
  component: WorkspaceShellContainer,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof WorkspaceShellContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story with minimal setup
export const Default: Story = {
  render: () => <WorkspaceShellContainer />,
};

// Story with multiple spaces and tab groups
const multiSpaceWorkspace: WorkspaceState = {
  spaces: [
    {
      id: 'space_1',
      name: 'Development',
      icon: 'code',
      tabGroupIds: ['tg_1', 'tg_2'],
    },
    {
      id: 'space_2',
      name: 'Design',
      icon: 'palette',
      tabGroupIds: ['tg_3'],
    },
    {
      id: 'space_3',
      name: 'Research',
      icon: 'book',
      tabGroupIds: ['tg_4'],
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
          title: 'VS Code',
          url: 'https://vscode.dev',
          pinned: true,
        },
        {
          id: 'tab_2',
          title: 'GitHub',
          url: 'https://github.com',
        },
        {
          id: 'tab_3',
          title: 'Stack Overflow',
          url: 'https://stackoverflow.com',
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
    {
      id: 'tg_2',
      label: 'Terminal',
      activeItemId: 'tab_4',
      tabs: [
        {
          id: 'tab_4',
          title: 'Shell',
          url: 'https://replit.com',
        },
      ],
      pairs: [],
      order: 1,
    },
    {
      id: 'tg_3',
      label: 'Design Tools',
      activeItemId: 'tab_5',
      tabs: [
        {
          id: 'tab_5',
          title: 'Figma',
          url: 'https://figma.com',
          pinned: true,
        },
        {
          id: 'tab_6',
          title: 'Excalidraw',
          url: 'https://excalidraw.com',
        },
      ],
      pairs: [],
      order: 0,
    },
    {
      id: 'tg_4',
      label: 'Documentation',
      activeItemId: 'pair_2',
      tabs: [
        {
          id: 'tab_7',
          title: 'React Docs',
          url: 'https://react.dev',
        },
        {
          id: 'tab_8',
          title: 'MDN',
          url: 'https://developer.mozilla.org',
        },
        {
          id: 'tab_9',
          title: 'TypeScript',
          url: 'https://typescriptlang.org/docs',
        },
      ],
      pairs: [
        {
          id: 'pair_2',
          tabIds: ['tab_7', 'tab_8'],
          ratios: [1, 1],
        },
      ],
      order: 0,
    },
  ],
  nextId: 20,
};

export const MultipleSpaces: Story = {
  render: () => <WorkspaceShellContainer initialWorkspace={multiSpaceWorkspace} />,
};

// Story with split views
const splitViewWorkspace: WorkspaceState = {
  spaces: [
    {
      id: 'space_1',
      name: 'Split View Demo',
      icon: 'columns',
      tabGroupIds: ['tg_1'],
    },
  ],
  tabGroups: [
    {
      id: 'tg_1',
      label: 'Comparison',
      activeItemId: 'pair_1',
      tabs: [
        {
          id: 'tab_1',
          title: 'Documentation',
          url: 'https://react.dev',
        },
        {
          id: 'tab_2',
          title: 'Code Editor',
          url: 'https://codesandbox.io',
        },
        {
          id: 'tab_3',
          title: 'Preview',
          url: 'https://stackblitz.com',
        },
      ],
      pairs: [
        {
          id: 'pair_1',
          tabIds: ['tab_1', 'tab_2'],
          ratios: [1, 2],
        },
        {
          id: 'pair_2',
          tabIds: ['tab_2', 'tab_3'],
          ratios: [1, 1],
        },
      ],
      order: 0,
    },
  ],
  nextId: 10,
};

export const SplitView: Story = {
  render: () => <WorkspaceShellContainer initialWorkspace={splitViewWorkspace} />,
};

// Empty space story
const emptySpaceWorkspace: WorkspaceState = {
  spaces: [
    {
      id: 'space_1',
      name: 'Empty Space',
      icon: 'folder',
      tabGroupIds: [],
    },
  ],
  tabGroups: [],
  nextId: 5,
};

export const EmptySpace: Story = {
  render: () => <WorkspaceShellContainer initialWorkspace={emptySpaceWorkspace} />,
};

// Many tab groups story
const manyTabGroupsWorkspace: WorkspaceState = {
  spaces: [
    {
      id: 'space_1',
      name: 'Busy Workspace',
      icon: 'grid',
      tabGroupIds: ['tg_1', 'tg_2', 'tg_3', 'tg_4'],
    },
  ],
  tabGroups: [
    {
      id: 'tg_1',
      label: 'Group 1',
      activeItemId: 'tab_1',
      tabs: [{ id: 'tab_1', title: 'Tab 1', url: 'https://example.com' }],
      pairs: [],
      order: 0,
    },
    {
      id: 'tg_2',
      label: 'Group 2',
      activeItemId: 'tab_2',
      tabs: [{ id: 'tab_2', title: 'Tab 2', url: 'https://example.com' }],
      pairs: [],
      order: 1,
    },
    {
      id: 'tg_3',
      label: 'Group 3',
      activeItemId: 'tab_3',
      tabs: [{ id: 'tab_3', title: 'Tab 3', url: 'https://example.com' }],
      pairs: [],
      order: 2,
    },
    {
      id: 'tg_4',
      label: 'Group 4',
      activeItemId: 'tab_4',
      tabs: [{ id: 'tab_4', title: 'Tab 4', url: 'https://example.com' }],
      pairs: [],
      order: 3,
    },
  ],
  nextId: 10,
};

export const ManyTabGroups: Story = {
  render: () => <WorkspaceShellContainer initialWorkspace={manyTabGroupsWorkspace} />,
};
