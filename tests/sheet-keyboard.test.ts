import { expect } from "chai";
import { nextSheetKeyboard, SHEET_KEYBOARD_CLOSED, type SheetKeyboard } from "../app/lib/useSheetKeyboard";

// An iPhone-sized layout viewport; the keyboard shrinks the visual viewport, never the layout.
const LAYOUT = 750;
const view = (height: number, layoutHeight = LAYOUT) => ({ layoutHeight, height });

function run(steps: [ReturnType<typeof view>, boolean][]): SheetKeyboard {
  return steps.reduce((state, [v, focused]) => nextSheetKeyboard(state, v, focused), SHEET_KEYBOARD_CLOSED);
}

describe("nextSheetKeyboard", () => {
  it("stays collapsed while the visual viewport fills the layout", () => {
    expect(run([[view(LAYOUT), false]])).to.deep.equal({ expanded: false, inset: 0, reserve: 0, layoutHeight: LAYOUT });
  });

  it("ignores a small shrink (browser chrome, not a keyboard)", () => {
    expect(run([[view(LAYOUT - 60), true]]).expanded).to.equal(false);
  });

  it("expands and clears the keyboard when it opens", () => {
    expect(run([[view(359.6), true]])).to.deep.equal({ expanded: true, inset: 390, reserve: 0, layoutHeight: LAYOUT });
  });

  it("keeps the visible area on the real keyboard when it hides for a picker, holding the difference as scroll room", () => {
    const s = run([[view(360), true], [view(LAYOUT), true]]);
    expect(s).to.deep.equal({ expanded: true, inset: 0, reserve: 390, layoutHeight: LAYOUT });
  });

  it("holds scroll room when a number pad replaces the text keyboard", () => {
    const s = run([[view(360), true], [view(405), true]]);
    expect([s.inset, s.reserve]).to.deep.equal([345, 45]);
  });

  it("uses up the held room when the keyboard comes back", () => {
    const s = run([[view(360), true], [view(LAYOUT), true], [view(360), true]]);
    expect([s.inset, s.reserve]).to.deep.equal([390, 0]);
  });

  it("stays expanded but drops the scroll room once no field has focus", () => {
    const s = run([[view(360), true], [view(LAYOUT), false]]);
    expect(s).to.deep.equal({ expanded: true, inset: 0, reserve: 0, layoutHeight: LAYOUT });
  });

  it("takes the new keyboard as-is after the room was dropped", () => {
    const s = run([[view(360), true], [view(LAYOUT), false], [view(405), true]]);
    expect([s.inset, s.reserve]).to.deep.equal([345, 0]);
  });

  it("starts over when the layout itself changes (rotation)", () => {
    const s = run([[view(360), true], [view(390, 390), true]]);
    expect(s).to.deep.equal({ expanded: false, inset: 0, reserve: 0, layoutHeight: 390 });
  });
});
