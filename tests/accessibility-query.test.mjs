import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const apiFile = new URL("../pages/api/accessibility.js", import.meta.url);
const queueFile = new URL("../lib/accessibilityQueue.js", import.meta.url);

test("accessibility API contains the server buffer geometry pipeline", async () => {
  const src = await readFile(apiFile, "utf8");

  assert.match(src, /GEOMETRY_PIPELINES/);
  assert.match(src, /serverBuffer:\s*"serverBuffer"/);
});

test("server buffer SQL and exported GeoJSON roles remain distinct", async () => {
  const src = await readFile(apiFile, "utf8");

  assert.match(src, /ST_UnaryUnion\(\s*ST_Collect\(\s*ST_Buffer\(\$\{geomColumn\}::geography,\s*\$5::float\s*\)::geometry\s*\)\s*\)/s);
  assert.match(src, /polygon_geojson/);
  assert.match(src, /network_geojson/);
});

test("server timing exports the requested server-side breakdown", async () => {
  const src = await readFile(apiFile, "utf8");

  for (const field of [
    "nearestVertexMs",
    "routingQueryMs",
    "reachableEdgeSelectionMs",
    "geometryUnionMs",
    "geometrySimplificationMs",
    "geoJsonSerializationMs",
    "totalServerMs",
    "payloadBytes",
  ]) {
    assert.match(src, new RegExp(field));
  }

  assert.match(src, /Server-Timing/);
  assert.match(src, /geometry-union;dur=/);
  assert.match(src, /geojson-serialization;dur=/);
});

test("accessibility queue releases a group when no requests are running", async () => {
  const src = await readFile(queueFile, "utf8");

  assert.match(src, /group\.running\s*=\s*Math\.max\(0,\s*group\.running\s*-\s*1\)/);
  assert.match(src, /if\s*\(\s*group\.running\s*===\s*0\s*\)\s*{/);
});
