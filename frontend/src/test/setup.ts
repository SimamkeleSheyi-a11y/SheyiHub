import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement scrollIntoView (used by ConversationView to keep the
// latest message in view) — stub it so tests don't crash on a missing API.
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});

// jsdom doesn't implement matchMedia either (used by ThemeProvider to read the
// OS light/dark preference) — stub a "no preference" response.
window.matchMedia =
  window.matchMedia ??
  ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
