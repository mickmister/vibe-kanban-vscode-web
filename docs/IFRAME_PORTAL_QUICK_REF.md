# React Reverse Portal - Quick Reference

## Installation

```bash
pnpm add react-reverse-portal
```

## Basic Pattern

```typescript
import { createHtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';

// 1. Create portal node (once, in ref)
const portalNode = useRef(createHtmlPortalNode()).current;

// 2. Render content in InPortal
<InPortal node={portalNode}>
  <iframe src="https://example.com" />
</InPortal>

// 3. Display with OutPortal (can move around)
<OutPortal node={portalNode} />
```

## Multi-Tab Pattern

```typescript
function TabSystem({ tabs, activeTabId }) {
  // Create portal for each tab
  const portals = useRef<Map<string, PortalNode>>(new Map());

  useEffect(() => {
    tabs.forEach(tab => {
      if (!portals.current.has(tab.id)) {
        portals.current.set(tab.id, createHtmlPortalNode());
      }
    });
  }, [tabs]);

  return (
    <>
      {/* Step 1: Create all iframes */}
      {tabs.map(tab => (
        <InPortal key={tab.id} node={portals.current.get(tab.id)!}>
          <iframe src={tab.url} />
        </InPortal>
      ))}

      {/* Step 2: Show active, hide others */}
      {tabs.map(tab => (
        <div
          key={tab.id}
          style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
        >
          <OutPortal node={portals.current.get(tab.id)!} />
        </div>
      ))}
    </>
  );
}
```

## Components in This Project

### useIframePortals Hook

```typescript
import { useIframePortals } from './components/IframePanel';

const portals = useIframePortals(tabs);
// Returns: Map<string, PortalNode>
```

### IframePortalManager

```typescript
import { IframePortalManager } from './components/IframePortalManager';

<IframePortalManager
  iframes={[
    { id: '1', url: 'https://react.dev', title: 'React' }
  ]}
  activeIframeId="1"
  onIframeLoad={(id) => console.log('loaded', id)}
/>
```

### HorizontalTabGroupsV2WithIframes

```typescript
import { HorizontalTabGroupsV2WithIframes } from './react-chrome-tabs/src/HorizontalTabGroupsV2WithIframes';

<HorizontalTabGroupsV2WithIframes
  initialState={{
    groups: [{ id: 'g1', label: 'Docs', color: '#4285f4', collapsed: false }],
    tabs: [
      { id: 't1', title: 'React', groupId: 'g1', active: true, url: 'https://react.dev' }
    ]
  }}
  darkMode={false}
  showIframeContent={true}
/>
```

## Key Rules

✅ **DO**
- Create portal nodes in a ref
- Render all InPortals first
- Use display:none for hidden tabs
- Clean up portals when tabs removed

❌ **DON'T**
- Create portal nodes in render
- Unmount InPortals when hiding
- Have multiple InPortals per node
- Forget to clean up

## Visual Flow

```
Component Render
      │
      ├─► Create Portal Nodes (in ref)
      │   - portalNode1 = createHtmlPortalNode()
      │   - portalNode2 = createHtmlPortalNode()
      │   - portalNode3 = createHtmlPortalNode()
      │
      ├─► Render InPortals (create iframe content)
      │   - <InPortal node={1}><iframe src="a.com"/></InPortal>
      │   - <InPortal node={2}><iframe src="b.com"/></InPortal>
      │   - <InPortal node={3}><iframe src="c.com"/></InPortal>
      │
      └─► Render OutPortals (display iframes)
          - <div display:block><OutPortal node={1}/></div>  ← Visible
          - <div display:none><OutPortal node={2}/></div>   ← Hidden
          - <div display:none><OutPortal node={3}/></div>   ← Hidden
```

## Common Issues

### Issue: Iframe reloads on tab switch
**Cause**: Portal node created in render
**Fix**: Use ref to persist portal node

### Issue: Blank iframe
**Cause**: OutPortal rendered before InPortal
**Fix**: Ensure all InPortals render first

### Issue: Multiple iframes visible
**Cause**: Multiple OutPortals without display:none
**Fix**: Only one OutPortal visible at a time

## Files

- `src/components/IframePanel.tsx` - Main implementation
- `src/components/IframePortalManager.tsx` - Utility components
- `react-chrome-tabs/src/HorizontalTabGroupsV2WithIframes.tsx` - Complete example
- `docs/IFRAME_PORTAL_GUIDE.md` - Full documentation
- `docs/IFRAME_PORTAL_SUMMARY.md` - Implementation summary

## Resources

- [Full Guide](./IFRAME_PORTAL_GUIDE.md)
- [Summary](./IFRAME_PORTAL_SUMMARY.md)
- [Library Docs](https://github.com/httptoolkit/react-reverse-portal)
