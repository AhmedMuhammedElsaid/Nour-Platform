import { vi } from "vitest";

// webextension-polyfill throws "not in a browser extension" when loaded in Node.
// Mock it to proxy through globalThis.chrome, which individual tests stub via
// vi.stubGlobal("chrome", { ... }) — no test changes needed.
vi.mock("webextension-polyfill", () => ({
  default: new Proxy(
    {},
    {
      get(_target, prop: string) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (globalThis as any).chrome?.[prop] ?? {};
      },
    },
  ),
}));
