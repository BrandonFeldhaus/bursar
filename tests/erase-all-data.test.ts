import { expect } from "chai";
import { eraseAllData } from "../app/lib/eraseAllData";

// Erase used to navigate to a bare "/", which on GitHub Pages (served under /bursar) left the
// app for the root of the domain — a different site.
describe("eraseAllData", () => {
  let hadWindow: PropertyDescriptor | undefined;
  let hadStorage: PropertyDescriptor | undefined;
  let hadBase: string | undefined;
  let assigned: string[];
  let removed: string[];

  beforeEach(() => {
    assigned = [];
    removed = [];
    hadWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    hadStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    hadBase = process.env.NEXT_PUBLIC_BASE_PATH;
    const fakeWindow = { location: { assign: (url: string) => assigned.push(url) } };
    Object.defineProperty(globalThis, "window", { value: fakeWindow, configurable: true, writable: true });
    Object.defineProperty(globalThis, "localStorage", {
      value: { removeItem: (k: string) => removed.push(k) },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (hadWindow) Object.defineProperty(globalThis, "window", hadWindow);
    else delete (globalThis as { window?: unknown }).window;
    if (hadStorage) Object.defineProperty(globalThis, "localStorage", hadStorage);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
    if (hadBase === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = hadBase;
  });

  it("returns to the Overview under the base path, not the domain root", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/bursar";
    eraseAllData();
    expect(assigned).to.deep.equal(["/bursar/"]);
    expect(removed).to.include("budgetApp:v1");
  });

  it("goes to / when there is no base path (dev server, custom domain)", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "";
    eraseAllData();
    expect(assigned).to.deep.equal(["/"]);
  });
});
