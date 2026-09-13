import { expect } from "chai";
import { nextSheetKeyboard, SHEET_KEYBOARD_CLOSED, type SheetKeyboard } from "../app/lib/useSheetKeyboard";

// An iPhone-sized layout viewport; the keyboard shrinks the visual viewport, never the layout.
const LAYOUT = 750;
const view = (height: number, offsetTop = 0, layoutHeight = LAYOUT) => ({ layoutHeight, height, offsetTop });

type Step = [ReturnType<typeof view>, boolean, boolean?];
function run(steps: Step[]): SheetKeyboard {
  return steps.reduce((state, [v, focused, pin]) => nextSheetKeyboard(state, v, focused, pin), SHEET_KEYBOARD_CLOSED);
}

describe("nextSheetKeyboard", () => {
  it("stays unpinned until a field takes focus, whatever the viewport does", () => {
    expect(run([[view(LAYOUT), false]])).to.deep.equal({ ...SHEET_KEYBOARD_CLOSED, layoutHeight: LAYOUT });
    expect(run([[view(360), false]]).pinned).to.equal(false);
  });

  it("pins the moment a field takes focus, before any keyboard shows", () => {
    expect(run([[view(LAYOUT), true, true]])).to.deep.equal({ pinned: true, top: 0, inset: 0, reserve: 0, layoutHeight: LAYOUT });
  });

  it("clears the keyboard once it opens", () => {
    const s = run([[view(LAYOUT), true, true], [view(359.6), true]]);
    expect(s).to.deep.equal({ pinned: true, top: 0, inset: 390, reserve: 0, layoutHeight: LAYOUT });
  });

  it("ignores a small shortfall (browser chrome, not a keyboard)", () => {
    expect(run([[view(LAYOUT), true, true], [view(LAYOUT - 90), true]]).inset).to.equal(0);
  });

  it("follows a panned view so the sheet stays on screen: top moves down, the inset excludes the pan", () => {
    const s = run([[view(LAYOUT), true, true], [view(360, 120.4), true]]);
    expect([s.top, s.inset]).to.deep.equal([120, 270]);
  });

  it("keeps the visible area on the real keyboard when it hides for a picker, holding the difference as scroll room", () => {
    const s = run([[view(LAYOUT), true, true], [view(360), true], [view(LAYOUT), true]]);
    expect(s).to.deep.equal({ pinned: true, top: 0, inset: 0, reserve: 390, layoutHeight: LAYOUT });
  });

  it("holds scroll room when a number pad replaces the text keyboard", () => {
    const s = run([[view(LAYOUT), true, true], [view(360), true], [view(405), true]]);
    expect([s.inset, s.reserve]).to.deep.equal([345, 45]);
  });

  it("uses up the held room when the keyboard comes back", () => {
    const s = run([[view(LAYOUT), true, true], [view(360), true], [view(LAYOUT), true], [view(360), true]]);
    expect([s.inset, s.reserve]).to.deep.equal([390, 0]);
  });

  it("stays pinned but drops the scroll room once no field has focus", () => {
    const s = run([[view(LAYOUT), true, true], [view(360), true], [view(LAYOUT), false]]);
    expect(s).to.deep.equal({ pinned: true, top: 0, inset: 0, reserve: 0, layoutHeight: LAYOUT });
  });

  it("stays pinned through a layout change (rotation) but drops the held room", () => {
    const s = run([[view(LAYOUT), true, true], [view(360), true], [view(390, 0, 390), true]]);
    expect(s).to.deep.equal({ pinned: true, top: 0, inset: 0, reserve: 0, layoutHeight: 390 });
  });
});
