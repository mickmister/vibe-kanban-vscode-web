import React from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { TabGroup, Tab } from '../types';

interface IframePanelProps {
  tabGroup: TabGroup;
  onUpdatePairRatios: (pairId: string, ratios: number[]) => void;
}

function IframeView({ tab }: { tab: Tab }) {
  return (
    <iframe
      src={tab.url}
      title={tab.title}
      className="w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      allow="clipboard-read; clipboard-write; fullscreen"
      role="region"
    />
  );
}

export function IframePanel({ tabGroup, onUpdatePairRatios }: IframePanelProps) {
  const activeTab = tabGroup.tabs.find(
    (t) => t.id === tabGroup.activeItemId
  );
  const activePair = tabGroup.pairs.find(
    (p) => p.id === tabGroup.activeItemId
  );

  if (activePair) {
    const pairTabs = activePair.tabIds
      .map((id) => tabGroup.tabs.find((t) => t.id === id))
      .filter((t): t is Tab => t != null);

    // ratios are already percentages in our data model
    const percentages = activePair.ratios;

    // Handle layout changes from the Group component
    const handleLayoutChange = (layout: { [id: string]: number }) => {
      // Convert layout object back to array based on tab order
      const newRatios = pairTabs.map((tab) => layout[tab.id] || 0);
      onUpdatePairRatios(activePair.id, newRatios);
    };

    return (
      <Group
        orientation="horizontal"
        className="flex-1 min-h-0"
        onLayoutChanged={handleLayoutChange}
      >
        {pairTabs.map((tab, i) => (
          <React.Fragment key={tab.id}>
            <Panel id={tab.id} defaultSize={percentages[i]} minSize={10}>
              <IframeView tab={tab} />
            </Panel>
            {i < pairTabs.length - 1 && (
              <Separator className="w-1 bg-neutral-700 hover:bg-neutral-500 data-[resize-handle-state=drag]:bg-primary-500 transition-colors cursor-col-resize flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
      </Group>
    );
  }

  if (activeTab) {
    return (
      <div className="flex-1 min-h-0">
        <IframeView tab={activeTab} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center text-neutral-500">
      <p>No tab selected. Click + to add a tab.</p>
    </div>
  );
}
