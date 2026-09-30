import { expect } from "chai";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildVersion, precacheFiles, renderServiceWorker } from "../scripts/build-sw";

// ─── A miniature static export ──────────────────────────────────────────────

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "bursar-sw-"));
  mkdirSync(path.join(dir, "_next", "static", "chunks"), { recursive: true });
  mkdirSync(path.join(dir, "icons"));
  writeFileSync(path.join(dir, "index.html"), "<html>home</html>");
  writeFileSync(path.join(dir, "index.txt"), "rsc");
  writeFileSync(path.join(dir, "budget.html"), "<html>budget</html>");
  writeFileSync(path.join(dir, "_next", "static", "chunks", "app-abc.js"), "js");
  writeFileSync(path.join(dir, "icons", "icon-192.png"), "png");
  writeFileSync(path.join(dir, "sw.js"), "old worker");
  writeFileSync(path.join(dir, ".DS_Store"), "");
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("precacheFiles", () => {
  it("lists every exported file with forward-slash relative paths, sorted", () => {
    expect(precacheFiles(dir)).to.deep.equal([
      "_next/static/chunks/app-abc.js",
      "budget.html",
      "icons/icon-192.png",
      "index.html",
      "index.txt",
    ]);
  });

  it("leaves out the worker itself and .DS_Store", () => {
    expect(precacheFiles(dir)).to.not.include.members(["sw.js", ".DS_Store"]);
  });
});

describe("buildVersion", () => {
  it("is stable for the same files", () => {
    const files = precacheFiles(dir);
    expect(buildVersion(dir, files)).to.equal(buildVersion(dir, files)).and.to.have.length(12);
  });

  it("changes when any file's content changes", () => {
    const before = buildVersion(dir, precacheFiles(dir));
    writeFileSync(path.join(dir, "budget.html"), "<html>budget v2</html>");
    expect(buildVersion(dir, precacheFiles(dir))).to.not.equal(before);
  });
});

describe("renderServiceWorker", () => {
  const template = readFileSync(path.join(__dirname, "..", "scripts", "sw.template.js"), "utf8");

  it("fills in the version and file list", () => {
    const sw = renderServiceWorker(template, "abc123", ["index.html", "budget.html"]);
    expect(sw).to.include('const VERSION = "abc123";');
    expect(sw).to.include('const FILES = ["index.html","budget.html"];');
    expect(sw).to.not.match(/__VERSION__|__FILES__/);
  });
});
