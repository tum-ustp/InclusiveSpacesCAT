import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const apiFile = new URL("../pages/api/accessibility.js", import.meta.url);

test("accessibility API contains the three benchmarkable geometry pipelines", async () => {
  const src = await readFile(apiFile, "utf8");

  assert.match(src, /GEOMETRY_PIPELINES/);
  assert.match(src, /collect:\s*"collect"/);
  assert.match(src, /unaryUnion:\s*"unaryUnion"/);
  assert.match(src, /serverBuffer:\s*"serverBuffer"/);
});

test("collect, unary union, and server buffer SQL fragments remain distinct", async () => {
  const src = await readFile(apiFile, "utf8");

  assert.match(src, /ST_Collect\(\$\{geomColumn\}\)/);
  assert.match(src, /ST_LineMerge\(ST_UnaryUnion\(ST_Collect\(\$\{geomColumn\}\)\)\)/);
  assert.match(src, /ST_UnaryUnion\(\s*ST_Buffer\(\s*ST_Collect\(\$\{geomColumn\}\),\s*\$4::float\s*\)\s*\)/s);
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
