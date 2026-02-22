import React from 'react';
import type { TabGroup } from '../types';

interface AddressBarProps {
  tabGroup: TabGroup;
}

/**
 * Address bar displaying the URL(s) of the currently active tab(s)
 */
export function AddressBar({ tabGroup }: AddressBarProps) {
  const activeTab = tabGroup.tabs.find(
    (t) => t.id === tabGroup.activeItemId
  );
  const activePair = tabGroup.pairs.find(
    (p) => p.id === tabGroup.activeItemId
  );

  // Collect URLs to display
  const urls: string[] = [];
  if (activePair) {
    // Show URLs of all tabs in the pair
    const pairTabs = activePair.tabIds
      .map((id) => tabGroup.tabs.find((t) => t.id === id))
      .filter((t) => t !== undefined);
    urls.push(...pairTabs.map((t) => t.url));
  } else if (activeTab) {
    urls.push(activeTab.url);
  }

  if (urls.length === 0) {
    return null; // Don't render address bar if no tab is active
  }

  return (
    <div className="bg-neutral-900 border-b border-neutral-800 px-3 py-1.5 flex items-center gap-2">
      {urls.map((url, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="text-neutral-600">|</span>
          )}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-neutral-500 text-xs flex-shrink-0">🌐</span>
            <input
              type="text"
              value={url}
              readOnly
              className="bg-neutral-800 text-neutral-300 text-xs px-2 py-1 rounded flex-1 min-w-0 border border-neutral-700 focus:outline-none focus:border-primary-500"
            />
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
