// Writes the manifest JSON Schema for the pipeline (Phase 3) to validate its output against.
// Run: bun run --cwd packages/core export:schema
// test/schemas.test.ts fails when the committed file is out of date.
import { writeFileSync } from "node:fs";
import { manifestJsonSchema } from "../src/schemas.ts";

const target = new URL("../schema/manifest.schema.json", import.meta.url);
writeFileSync(target, `${JSON.stringify(manifestJsonSchema(), null, 2)}\n`);
console.log(`wrote ${target.pathname}`);
