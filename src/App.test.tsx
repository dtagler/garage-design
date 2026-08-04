import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the application title', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: /garage design/i })).toBeVisible();
  });

  it('renders the workspace region and opens on the garage and design section', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 2, name: /workspace/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Garage & design' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Drainable tile options' })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Planner steps' })).toBeNull();
  });
});
