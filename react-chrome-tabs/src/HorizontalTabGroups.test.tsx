import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as Stories from './HorizontalTabGroups.stories';

describe('HorizontalTabGroups Stories', () => {
  it('should render BasicUsage story', () => {
    const { container } = render(<Stories.BasicUsage />);
    expect(container).toBeTruthy();
  });

  it('should render WithActiveTabs story', () => {
    const { container } = render(<Stories.WithActiveTabs />);
    expect(container).toBeTruthy();
  });

  it('should render DarkMode story', () => {
    const { container } = render(<Stories.DarkMode />);
    expect(container).toBeTruthy();
  });

  it('should render ManyGroups story', () => {
    const { container } = render(<Stories.ManyGroups />);
    expect(container).toBeTruthy();
  });

  it('should render InteractiveDemo story', () => {
    const { container } = render(<Stories.InteractiveDemo />);
    expect(container).toBeTruthy();
  });
});
