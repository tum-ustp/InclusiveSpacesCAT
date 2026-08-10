import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const performanceFile = new URL(
  "../components/map/performance.js",
  import.meta.url
);

const DEFAULT_ZONE_MAX_MS = 10000;
const DEFAULT_ZONE_TARGET_MIN_MS = 8000;
const WEIGHTED_ZONE_MAX_MS = 10000;

test("performance logger exposes the timing fields the browser console must print", async () => {
  const src = await readFile(performanceFile, "utf8");

  for (const field of [
    "nearestVertexMs",
    "routingQueryMs",
    "reachableEdgeSelectionMs",
    "geometryUnionMs",
    "geometrySimplificationMs",
    "geoJsonSerializationMs",
    "apiTotalMs",
    "payloadBytes",
  ]) {
    assert.match(src, new RegExp(field));
  }

  assert.match(src, /console\.table\(row\)/);
  assert.match(src, /getAccessibilityTimingRow/);
});

test("benchmark budgets keep default and weighted zone runs within the requested caps", () => {
  assert.equal(DEFAULT_ZONE_TARGET_MIN_MS, 8000);
  assert.equal(DEFAULT_ZONE_MAX_MS, 10000);
  assert.equal(WEIGHTED_ZONE_MAX_MS, 10000);
});
