import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Adds jest-dom's matchers (toBeInTheDocument, toHaveTextContent, etc.) to
// vitest's `expect` — loaded once for every test file via vite.config.js's
// `test.setupFiles`, so component tests don't each need this import themselves.
import '@testing-library/jest-dom/vitest';

// Testing Library's own auto-cleanup only registers itself when it finds an
// `afterEach` global — this project doesn't run vitest in `globals: true` mode
// (existing lib/*.test.js files import `describe`/`it`/`expect` explicitly), so
// without this every component test would leave its render mounted for the next
// one, causing "multiple elements found" failures across files.
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement matchMedia — App.jsx checks it for PWA install state
// on every render, so without a stub any test that mounts App crashes immediately.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom doesn't implement ResizeObserver either — components/FixedHeader.jsx (used
// by nearly every screen, to size the space under the sticky header) uses one to
// measure itself, so without a stub any screen mounting it crashes on layout effect.
if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
