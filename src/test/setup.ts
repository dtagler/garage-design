import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  // The workspace autosaves the active draft to localStorage, and unmounting flushes
  // any pending write, so every test has to start from an empty browser store.
  globalThis.localStorage?.clear();
});
