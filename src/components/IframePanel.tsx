import React, { useRef, useState, useCallback } from 'react';
import type { TabGroup, Tab, TabPair } from '../types';

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

function ResizeHandle({
  onResize,
}: {
  onResize: (deltaX: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(true);
      startXRef.current = e.clientX;

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startXRef.current;
        startXRef.current = ev.clientX;
        onResize(delta);
      };

      const handleMouseUp = () => {
        setDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [onResize]
  );

  return (
    <div
      className={`w-1 cursor-col-resize flex-shrink-0 transition-colors ${
        dragging ? 'bg-primary-500' : 'bg-neutral-700 hover:bg-neutral-500'
      }`}
      onMouseDown={handleMouseDown}
    />
  );
}

export function IframePanel({ tabGroup, onUpdatePairRatios }: IframePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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

    const totalRatio = activePair.ratios.reduce((a, b) => a + b, 0);

    const handleResize = (index: number, deltaX: number) => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const ratioPerPixel = totalRatio / containerWidth;
      const deltaRatio = deltaX * ratioPerPixel;

      const newRatios = [...activePair.ratios];
      newRatios[index] = Math.max(0.5, newRatios[index] + deltaRatio);
      newRatios[index + 1] = Math.max(
        0.5,
        newRatios[index + 1] - deltaRatio
      );
      onUpdatePairRatios(activePair.id, newRatios);
    };

    return (
      <div ref={containerRef} className="flex flex-1 min-h-0">
        {pairTabs.map((tab, i) => (
          <React.Fragment key={tab.id}>
            <div
              style={{
                flex: activePair.ratios[i] || 1,
              }}
              className="min-w-0 h-full"
            >
              <IframeView tab={tab} />
            </div>
            {i < pairTabs.length - 1 && (
              <ResizeHandle onResize={(delta) => handleResize(i, delta)} />
            )}
          </React.Fragment>
        ))}
      </div>
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
