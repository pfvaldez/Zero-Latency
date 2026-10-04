// The Responsible AI and data-card documents must not claim more than the repository proves:
// every `file` :: `test title` reference has to exist, and every dataset row has to be complete.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("docs/RESPONSIBLE_AI.md", () => {
  const md = read("docs/RESPONSIBLE_AI.md");
  const refs = [
    ...md.matchAll(/`([^`\s]+\.(?:test|spec)\.ts|[^`\s]+\/test_[a-z_]+\.py)` :: `([^`]+)`/g),
  ].map((m) => ({
    file: m[1] as string,
    title: m[2] as string,
  }));

  it("references at least one proving test for each of the ten guardrails", () => {
    for (let n = 1; n <= 10; n++) {
      const row = md.split("\n").find((l) => l.startsWith(`| ${n} |`));
      expect(row, `row ${n}`).toBeDefined();
      expect(row).toMatch(/ :: /);
    }
    expect(refs.length).toBeGreaterThanOrEqual(25);
  });

  it("only points at tests that exist (the file exists and contains the exact title)", () => {
    for (const { file, title } of refs) {
      const source = read(file);
      const found = file.endsWith(".py")
        ? source.includes(`def ${title}(`)
        : source.includes(title);
      expect(found, `${file} :: ${title}`).toBe(true);
    }
  });

  it("says plainly what is not built, so it cannot be read as more than it is", () => {
    expect(md).toContain("DRAFT for Preet");
    expect(md).toContain("do not exist in the repository yet");
    expect(md).toContain("The airplane-mode end-to-end test does not exist");
  });
});

describe("docs/DATA_CARD.md", () => {
  const md = read("docs/DATA_CARD.md");
  const rows = md
    .split("\n")
    .filter((l) => l.startsWith("| ") && !l.startsWith("| ---") && !l.startsWith("|---"))
    .map((l) =>
      l
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim()),
    );
  const datasets = rows.filter((r) => r.length === 7 && r[0] !== "Name");

  it("has a complete row (source, revision, license, size, use, gaps) for every model and dataset", () => {
    expect(datasets.length).toBeGreaterThanOrEqual(12);
    for (const r of datasets)
      for (const [i, cell] of r.entries())
        expect(cell.length, `${r[0]} column ${i}`).toBeGreaterThan(0);
  });

  it("calls out the non-commercial licenses of NLLB and MMS at the top and in their rows", () => {
    expect(md.slice(0, 1500)).toContain("CC-BY-NC-4.0");
    for (const name of ["NLLB-200 distilled 600M", "Meta MMS-1b-all with the `wol` adapter"]) {
      const row = datasets.find((r) => r[0] === name);
      expect(row, name).toBeDefined();
      expect(row?.[3]).toContain("CC-BY-NC-4.0");
    }
  });

  it("names every model by its exact revision", () => {
    expect(md).toContain("761b726dd34fb83930e26aab4e9ac3899aa1fa78");
    expect(md).toContain("f8d333a098d19b4fd9a8b18f94170487ad3f821d");
    expect(md).toContain("3d33597edbdaaba14a8e858e2c8caa76e3cec0cd");
  });

  it("has a labels table covering the synthetic, stand-in, AI-dubbed and machine-draft items", () => {
    for (const item of [
      "Preet's English recordings",
      "AI-dubbed Wolof clips",
      "NLLB translations",
      "The 116 test questions",
      "Fixture pack",
    ]) {
      expect(md).toContain(item);
    }
  });
});
