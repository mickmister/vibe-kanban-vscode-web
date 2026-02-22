# Iframe Portal Management with react-reverse-portal

This guide explains how we use `react-reverse-portal` to manage iframe content in the vibe-kanban application.

## The Problem

Traditional React iframe management has a critical issue: when a component unmounts, its iframe is destroyed and reloaded on remount. This causes:

- **Loss of state**: Forms, scroll position, and user interactions are lost
- **Expensive reloads**: Full page reload on every tab switch
- **Poor UX**: Users see loading spinners frequently
- **Wasted bandwidth**: Same content loaded multiple times

## The Solution: react-reverse-portal

`react-reverse-portal` allows us to create iframe content once and "move" it between containers without destroying it.

### Key Concepts

1. **Portal Node**: A persistent container created with `createHtmlPortalNode()`
2. **InPortal**: Renders content into the portal node (creates the iframe)
3. **OutPortal**: Displays the portal node's content (shows the iframe)
4. **display:none Strategy**: Hidden iframes stay in memory with `display:none`

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Component Tree                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ InPortal Nodes (created once, stay in memory)   │  │
│  │                                                   │  │
│  │  <InPortal node={portal1}>                       │  │
│  │    <iframe src="tab1.com" />                     │  │
│  │  </InPortal>                                      │  │
│  │                                                   │  │
│  │  <InPortal node={portal2}>                       │  │
│  │    <iframe src="tab2.com" />                     │  │
│  │  </InPortal>                                      │  │
│  │                                                   │  │
│  │  <InPortal node={portal3}>                       │  │
│  │    <iframe src="tab3.com" />                     │  │
│  │  </InPortal>                                      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ OutPortal Display (visible or hidden)           │  │
│  │                                                   │  │
│  │  <div style={{display: 'block'}}>                │  │
│  │    <OutPortal node={portal1} />  ← Visible      │  │
│  │  </div>                                           │  │
│  │                                                   │  │
│  │  <div style={{display: 'none'}}>                 │  │
│  │    <OutPortal node={portal2} />  ← Hidden       │  │
│  │  </div>                                           │  │
│  │                                                   │  │
│  │  <div style={{display: 'none'}}>                 │  │
│  │    <OutPortal node={portal3} />  ← Hidden       │  │
│  │  </div>                                           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Create Portal Nodes

Use a custom hook to manage portal lifecycle:

```typescript
import { createHtmlPortalNode } from 'react-reverse-portal';

function useIframePortals(tabs: Tab[]) {
  const portalsRef = useRef<Map<string, ReturnType<typeof createHtmlPortalNode>>>(new Map());

  useEffect(() => {
    const currentPortals = portalsRef.current;
    const currentTabIds = new Set(tabs.map((tab) => tab.id));

    // Clean up removed tabs
    for (const [id] of currentPortals.entries()) {
      if (!currentTabIds.has(id)) {
        currentPortals.delete(id);
      }
    }

    // Create portals for new tabs
    for (const tab of tabs) {
      if (!currentPortals.has(tab.id)) {
        currentPortals.set(tab.id, createHtmlPortalNode());
      }
    }
  }, [tabs]);

  return portalsRef.current;
}
```

### 2. Render InPortals

Create all iframe content once:

```typescript
{tabs.map((tab) => {
  const portalNode = portals.get(tab.id);
  if (!portalNode) return null;

  return (
    <InPortal key={tab.id} node={portalNode}>
      <iframe
        src={tab.url}
        title={tab.title}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </InPortal>
  );
})}
```

### 3. Display with OutPortals

Show/hide iframes based on active state:

```typescript
{tabs.map((tab) => {
  const portalNode = portals.get(tab.id);
  if (!portalNode) return null;

  const isActive = tab.id === activeTabId;

  return (
    <div
      key={tab.id}
      style={{ display: isActive ? 'block' : 'none' }}
    >
      <OutPortal node={portalNode} />
    </div>
  );
})}
```

## Components

### IframePanel.tsx

Updated to use react-reverse-portal for tab management:

- Creates portal nodes for all tabs
- Renders InPortals for iframe content
- Uses OutPortals to display active tab(s)
- Supports split-screen pairs

### IframePortalManager.tsx

Utility component for managing iframe portals:

- `useIframePortals`: Hook to manage portal lifecycle
- `IframePortalContent`: Renders iframe in InPortal
- `IframePortalOutlet`: Displays iframe with OutPortal
- `IframePortalManager`: Complete manager component

### HorizontalTabGroupsV2WithIframes.tsx

Complete Chrome-style tab system with iframes:

- Group-based tab organization
- Lazy loading on first activation
- Persistent iframes with display:none
- Full tab management (close, duplicate, rename)

## Benefits

### Performance

- ✅ **No Reloads**: Iframes never unmount or reload
- ✅ **Instant Switching**: Tab changes are immediate
- ✅ **Memory Efficient**: One iframe per tab, not per render

### User Experience

- ✅ **State Preservation**: Forms, scroll, interactions preserved
- ✅ **Fast Navigation**: No loading spinners on tab switch
- ✅ **Predictable Behavior**: Tabs work like browser tabs

### Developer Experience

- ✅ **Simple API**: Hook-based interface
- ✅ **Automatic Cleanup**: Portals removed when tabs close
- ✅ **Type Safe**: Full TypeScript support

## Common Patterns

### Single Active Tab

```typescript
const portals = useIframePortals(tabs);
const activeTab = tabs.find(t => t.active);

return (
  <>
    {/* Create all iframes */}
    {tabs.map(tab => (
      <InPortal key={tab.id} node={portals.get(tab.id)!}>
        <iframe src={tab.url} />
      </InPortal>
    ))}

    {/* Show only active tab */}
    {tabs.map(tab => (
      <div key={tab.id} style={{ display: tab.active ? 'block' : 'none' }}>
        <OutPortal node={portals.get(tab.id)!} />
      </div>
    ))}
  </>
);
```

### Split Screen (Multiple Visible)

```typescript
const visibleTabs = tabs.filter(t => pairTabIds.includes(t.id));

return (
  <>
    {/* Create all iframes */}
    {tabs.map(tab => (
      <InPortal key={tab.id} node={portals.get(tab.id)!}>
        <iframe src={tab.url} />
      </InPortal>
    ))}

    {/* Show visible tabs in split view */}
    <div className="flex">
      {visibleTabs.map(tab => (
        <div key={tab.id} className="flex-1">
          <OutPortal node={portals.get(tab.id)!} />
        </div>
      ))}
    </div>

    {/* Hide other tabs */}
    {tabs.filter(t => !pairTabIds.includes(t.id)).map(tab => (
      <div key={tab.id} style={{ display: 'none' }}>
        <OutPortal node={portals.get(tab.id)!} />
      </div>
    ))}
  </>
);
```

### Lazy Loading

```typescript
const [loadedTabs, setLoadedTabs] = useState(new Set<string>());

const handleTabActivate = (tabId: string) => {
  setLoadedTabs(prev => new Set(prev).add(tabId));
};

// Only create portals for loaded tabs
const portals = useIframePortals(
  tabs.filter(t => loadedTabs.has(t.id))
);
```

## Testing

Run Storybook to see interactive examples:

```bash
npm run storybook
```

Stories available:

- `HorizontalTabGroupsV2WithIframes/BasicWithIframes`: Basic iframe tab system
- `HorizontalTabGroupsV2WithIframes/DarkModeWithIframes`: Dark mode variant
- `HorizontalTabGroupsV2WithIframes/TabBarOnly`: Tab bar without content area
- `HorizontalTabGroupsV2WithIframes/InteractiveDemo`: Full interactive demo

## Best Practices

### DO

- ✅ Create portal nodes in a ref to persist across renders
- ✅ Clean up portals when tabs are removed
- ✅ Use display:none for hidden tabs to keep them fresh
- ✅ Render all InPortals before any OutPortals

### DON'T

- ❌ Create portal nodes in render function
- ❌ Unmount InPortals when hiding tabs
- ❌ Create multiple InPortals for the same portal node
- ❌ Forget to clean up removed portals

## Troubleshooting

### Iframes reload on tab switch

**Problem**: Portal nodes being recreated on each render

**Solution**: Store portal nodes in a ref, not state

### Memory leaks

**Problem**: Portal nodes not cleaned up when tabs close

**Solution**: Use useEffect to remove portals for deleted tabs

### Blank iframes

**Problem**: OutPortal rendered before InPortal

**Solution**: Ensure all InPortals render before any OutPortals

### Content not updating

**Problem**: Multiple OutPortals for same portal node

**Solution**: Only one OutPortal per portal node should be visible

## References

- [react-reverse-portal GitHub](https://github.com/httptoolkit/react-reverse-portal)
- [React Portals Documentation](https://react.dev/reference/react-dom/createPortal)
- [MDN: iframe element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe)
