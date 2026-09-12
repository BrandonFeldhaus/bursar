import { expect } from "chai";
import { nextSheetKeyboard, SHEET_KEYBOARD_CLOSED, type SheetKeyboard } from "../app/lib/useSheetKeyboard";

// An iPhone-sized layout viewport; the keyboard shrinks the visual viewport, never the layout.
const LAYOUT = 750;
const view = (height: number, offsetTop = 0, layoutHeight = LAYOUT) => ({ layoutHeight, height, offsetTop });

function run(steps: [ReturnType<typeof view>, boolean][]): SheetKeyboard {
  return steps.reduce((state, [v, focused]) => nextSheetKeyboard(state, v, focused), SHEET_KEYBOARD_CLOSED);
}

describe("nextSheetKeyboard", () => {
  it("stays collapsed while the visual viewport fills the layout", () => {
    expect(run([[view(LAYOUT), false]])).to.deep.equal({ expanded: false, top: 0, inset: 0, layoutHeight: LAYOUT });
  });

  it("ignores a small shrink (browser chrome, not a keyboard)", () => {
    expect(run([[view(LAYOUT - 60), true]]).expanded).to.equal(false);
  });

  it("expands and clears the keyboard when it opens", () => {
    expect(run([[view(360), true]])).to.deep.equal({ expanded: true, top: 0, inset: 390, layoutHeight: LAYOUT });
  });

  it("follows a panned view: top moves down, the inset excludes the pan", () => {
    const s = run([[view(360, 120.4), true]]);
    expect(s.top).to.equal(120);
    expect(s.inset).to.equal(270);
  });

  it("holds the inset when the keyboard hides for a select or date picker", () => {
    const s = run([[view(360), true], [view(LAYOUT), true]]);
    expect(s).to.deep.equal({ expanded: true, top: 0, inset: 390, layoutHeight: LAYOUT });
  });

  it("holds the larger inset when a number pad replaces the text keyboard", () => {
    expect(run([[view(360), true], [view(405), true]]).inset).to.equal(390);
  });

  it("stays expanded but releases the inset once no field has focus", () => {
    const s = run([[view(360), true], [view(LAYOUT), false]]);
    expect(s).to.deep.equal({ expanded: true, top: 0, inset: 0, layoutHeight: LAYOUT });
  });

  it("takes the new inset when the keyboard comes back after a release", () => {
    expect(run([[view(360), true], [view(LAYOUT), false], [view(405), true]]).inset).to.equal(345);
  });

  it("starts over when the layout itself changes (rotation)", () => {
    const s = run([[view(360), true], [view(390, 0, 390), true]]);
    expect(s).to.deep.equal({ expanded: false, top: 0, inset: 0, layoutHeight: 390 });
  });
});
