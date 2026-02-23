import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { TabGroup, Tab } from '../types';

interface IframePanelProps {
  tabGroup: TabGroup;
  activeItemId: string;
  onUpdatePairRatios: (pairId: string, ratios: number[]) => void;
}

/**
 * Module-level iframe store that persists across HMR updates.
 * Iframe DOM elements are managed imperatively so React re-renders
 * (including HMR fast refresh) never recreate them.
 */
type IframeEntry = {
  iframe: HTMLIFrameElement;
  container: HTMLDivElement;
  loaded: boolean;
  listeners: Set<() => void>;
};

let iframeStore: Map<string, IframeEntry> = new Map();

// Preserve iframe store across HMR updates using Vite's HMR API.
try {
  // @ts-expect-error -- import.meta.hot is Vite-specific, not available under module: commonjs
  const hot = import.meta.hot;
  if (hot) {
    if (hot.data.iframeStore) {
      iframeStore = hot.data.iframeStore;
    }
    hot.dispose((data: Record<string, unknown>) => {
      data.iframeStore = iframeStore;
    });
  }
} catch {
  // Not in Vite dev mode
}

function getOrCreateIframe(tab: Tab): IframeEntry {
  const existing = iframeStore.get(tab.id);
  if (existing) return existing;

  const container = document.createElement('div');
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.position = 'absolute';
  container.style.inset = '0';

  const iframe = document.createElement('iframe');
  iframe.src = tab.url;
  iframe.title = tab.title;
  iframe.className = 'w-full h-full border-0';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals');
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen');
  iframe.setAttribute('role', 'region');

  const entry: IframeEntry = { iframe, container, loaded: false, listeners: new Set() };

  iframe.addEventListener('load', () => {
    entry.loaded = true;
    entry.listeners.forEach((fn) => fn());
  });

  container.appendChild(iframe);
  iframeStore.set(tab.id, entry);

  return entry;
}

function removeIframe(tabId: string) {
  const entry = iframeStore.get(tabId);
  if (entry) {
    entry.container.remove();
    entry.listeners.clear();
    iframeStore.delete(tabId);
  }
}

/**
 * Ensure all iframes exist for the given tabs (eagerly, not in an effect).
 * Clean up stale entries in an effect.
 */
function useImperativeIframes(tabs: Tab[]) {
  // Eagerly create iframes so they're available for IframeHost immediately
  for (const tab of tabs) {
    getOrCreateIframe(tab);
  }

  const [loadingState, setLoadingState] = useState<Map<string, boolean>>(() => {
    const initial = new Map<string, boolean>();
    for (const tab of tabs) {
      const entry = iframeStore.get(tab.id);
      initial.set(tab.id, entry?.loaded ?? false);
    }
    return initial;
  });

  // Subscribe to load events
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    for (const tab of tabs) {
      const entry = iframeStore.get(tab.id);
      if (!entry) continue;

      // If already loaded, update state immediately
      if (entry.loaded) {
        setLoadingState((prev) => {
          if (prev.get(tab.id) === true) return prev;
          const next = new Map(prev);
          next.set(tab.id, true);
          return next;
        });
        continue;
      }

      // Otherwise subscribe to load
      const listener = () => {
        setLoadingState((prev) => {
          const next = new Map(prev);
          next.set(tab.id, true);
          return next;
        });
      };
      entry.listeners.add(listener);
      unsubs.push(() => entry.listeners.delete(listener));
    }

    return () => unsubs.forEach((fn) => fn());
  }, [tabs]);

  // Clean up stale iframes
  useEffect(() => {
    const currentTabIds = new Set(tabs.map((t) => t.id));
    for (const [id] of iframeStore.entries()) {
      if (!currentTabIds.has(id)) {
        removeIframe(id);
      }
    }
  }, [tabs]);

  return { loadingState };
}

/**
 * A container div that imperatively hosts an iframe DOM element.
 * The iframe is appended via useEffect, not rendered by React,
 * so it survives HMR and re-renders.
 */
function IframeHost({ tabId, visible }: { tabId: string; visible: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const entry = iframeStore.get(tabId);
    if (!host || !entry) return;

    host.appendChild(entry.container);

    return () => {
      if (entry.container.parentElement === host) {
        host.removeChild(entry.container);
      }
    };
  }, [tabId]);

  return (
    <div
      ref={hostRef}
      className="w-full h-full relative"
      style={{ display: visible ? 'block' : 'none' }}
    />
  );
}

export function IframePanel({ tabGroup, activeItemId, onUpdatePairRatios }: IframePanelProps) {
  const { loadingState } = useImperativeIframes(tabGroup.tabs);

  const activeTab = tabGroup.tabs.find(
    (t) => t.id === activeItemId
  );
  const activePair = tabGroup.pairs.find(
    (p) => p.id === activeItemId
  );

  const visibleTabIds = new Set<string>();
  if (activePair) {
    activePair.tabIds.forEach((id) => visibleTabIds.add(id));
  } else if (activeTab) {
    visibleTabIds.add(activeTab.id);
  }

  return (
    <>
      {tabGroup.tabs.map((tab) => {
        if (visibleTabIds.has(tab.id)) return null;
        return <IframeHost key={tab.id} tabId={tab.id} visible={false} />;
      })}

      {activePair ? (
        <PairView
          activePair={activePair}
          tabGroup={tabGroup}
          loadingState={loadingState}
          onUpdatePairRatios={onUpdatePairRatios}
        />
      ) : activeTab ? (
        <SingleTabView activeTab={activeTab} loadingState={loadingState} />
      ) : (
        <EmptyView />
      )}
    </>
  );
}

function SingleTabView({
  activeTab,
  loadingState,
}: {
  activeTab: Tab;
  loadingState: Map<string, boolean>;
}) {
  const isLoaded = loadingState.get(activeTab.id) ?? false;

  return (
    <div className="flex-1 min-h-0 relative h-full">
      <IframeHost tabId={activeTab.id} visible={true} />
      {!isLoaded && <LoadingOverlay />}
    </div>
  );
}

function PairView({
  activePair,
  tabGroup,
  loadingState,
  onUpdatePairRatios,
}: {
  activePair: { id: string; tabIds: string[]; ratios: number[] };
  tabGroup: TabGroup;
  loadingState: Map<string, boolean>;
  onUpdatePairRatios: (pairId: string, ratios: number[]) => void;
}) {
  const pairTabs = activePair.tabIds
    .map((id) => tabGroup.tabs.find((t) => t.id === id))
    .filter((t): t is Tab => t != null);

  const percentages = activePair.ratios;

  const handleLayoutChange = (layout: { [id: string]: number }) => {
    const newRatios = pairTabs.map((tab) => layout[tab.id] || 0);
    onUpdatePairRatios(activePair.id, newRatios);
  };

  return (
    <Group
      orientation="horizontal"
      className="flex-1 min-h-0"
      onLayoutChanged={handleLayoutChange}
    >
      {pairTabs.map((tab, i) => {
        const isLoaded = loadingState.get(tab.id) ?? false;

        return (
          <React.Fragment key={tab.id}>
            <Panel id={tab.id} defaultSize={percentages[i]} minSize={10}>
              <div className="relative w-full h-full">
                <IframeHost tabId={tab.id} visible={true} />
                {!isLoaded && <LoadingOverlay />}
              </div>
            </Panel>
            {i < pairTabs.length - 1 && (
              <Separator className="w-1 bg-neutral-700 hover:bg-neutral-500 data-[resize-handle-state=drag]:bg-primary-500 transition-colors cursor-col-resize flex-shrink-0" />
            )}
          </React.Fragment>
        );
      })}
    </Group>
  );
}

function EmptyView() {
  return (
    <div className="flex-1 flex items-center justify-center text-neutral-500">
      <p>No tab selected. Click + to add a tab.</p>
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-neutral-950 flex items-center justify-center z-10">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        <p className="text-neutral-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}
