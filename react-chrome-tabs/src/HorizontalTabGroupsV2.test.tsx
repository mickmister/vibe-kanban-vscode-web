import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as Stories from './HorizontalTabGroupsV2.stories';

describe('HorizontalTabGroupsV2 Stories', () => {
  it('should render BasicUsage story', () => {
    const { container } = render(<Stories.BasicUsage />);
    expect(container).toBeTruthy();
  });

  it('should render AllExpanded story', () => {
    const { container } = render(<Stories.AllExpanded />);
    expect(container).toBeTruthy();
  });

  it('should render MostlyCollapsed story', () => {
    const { container } = render(<Stories.MostlyCollapsed />);
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
