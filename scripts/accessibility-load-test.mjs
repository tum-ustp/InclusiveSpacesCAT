import { performance } from "node:perf_hooks";

const getArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const numberArg = (name, fallback) => {
  const value = Number(getArg(name, fallback));
  return Number.isFinite(value) ? value : fallback;
};

const baseUrl = getArg("url", "http://localhost:3000");
const count = numberArg("count", 12);
const timeoutMs = numberArg("timeout", 250000);
const city = getArg("city", "hamburg");
const lat = getArg("lat", null);
const lon = getArg("lon", null);
const time = getArg("time", "15");
const speed = getArg("speed", "5");
const weightedValue = getArg("weighted-value", "0.5");
const useCustomPoint = lat !== null && lon !== null;
const runId = Date.now();
let completedOrder = 0;

const hamburgPoints = [
  { lon: "9.98772744810847", lat: "53.5544208099801" },
  { lon: "9.993682", lat: "53.551086" },
  { lon: "10.006559", lat: "53.553614" },
  { lon: "9.974764", lat: "53.548849" },
  { lon: "9.961705", lat: "53.559623" },
  { lon: "10.017094", lat: "53.548058" },
  { lon: "9.982036", lat: "53.567365" },
  { lon: "10.029199", lat: "53.571565" },
  { lon: "9.935183", lat: "53.551872" },
];

const hamburgWeightedParams = {
  noise: weightedValue,
  light: weightedValue,
  trafficLight: weightedValue,
  tactile: weightedValue,
  tree: weightedValue,
  temperatureSummer: weightedValue,
  temperatureWinter: weightedValue,
  blueinf: weightedValue,
  greeninf: weightedValue,
  station: weightedValue,
  wcDisabled: weightedValue,
  narrowRoads: weightedValue,
  stair: weightedValue,
  obstacle: weightedValue,
  slope: weightedValue,
  unevenSurface: weightedValue,
  poorPavement: weightedValue,
  kerbsHigh: weightedValue,
  facility: weightedValue,
  pedestrianFlow: weightedValue,
};

const percentile = (values, p) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
};

const round = (value) => Number((value || 0).toFixed(2));

const runRequest = async (index, mode) => {
  const requestId = `load-${runId}-${index}-${mode}`;
  const queueGroupId = `load-${runId}-${index}`;
  const url = new URL("/api/accessibility", baseUrl);
  const point = useCustomPoint
    ? { lat, lon }
    : hamburgPoints[(index - 1) % hamburgPoints.length];
  const params = new URLSearchParams({
    requestId,
    queueGroupId,
    city,
    lat: point.lat,
    lon: point.lon,
    time,
    speed,
    mode,
    geometry: "simplified",
  });

  if (mode === "weighted") {
    for (const [key, value] of Object.entries(hamburgWeightedParams)) {
      params.set(key, value);
    }
  }

  url.search = params.toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    const endedAt = performance.now();
    let body = null;

    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { error: text.slice(0, 160) };
    }

    const timing = body?.timing || {};

    return {
      index,
      mode,
      requestId,
      ok: response.ok,
      httpStatus: response.status,
      error: body?.error || "",
      endToEndMs: round(endedAt - startedAt),
      queueWaitMs: round(timing.queueWaitMs),
      queuePositionAtEnqueue: timing.queuePositionAtEnqueue ?? "",
      apiTotalMs: round(timing.apiTotalMs),
      routingQueryMs: round(timing.routingQueryMs),
      polygonBytes: timing.polygonBytes || 0,
      networkBytes: timing.networkBytes || 0,
      payloadBytes: timing.payloadBytes || 0,
      polygonFeatureCount: timing.polygonFeatureCount || 0,
      clientNetworkFeatureCount: body?.network?.features?.length || 0,
      completedOrder: ++completedOrder,
    };
  } catch (error) {
    return {
      index,
      mode,
      requestId,
      ok: false,
      httpStatus: error?.name === "AbortError" ? "timeout" : "error",
      error: error?.message || String(error),
      endToEndMs: round(performance.now() - startedAt),
      queueWaitMs: "",
      queuePositionAtEnqueue: "",
      apiTotalMs: "",
      routingQueryMs: "",
      polygonBytes: 0,
      networkBytes: 0,
      payloadBytes: 0,
      polygonFeatureCount: 0,
      clientNetworkFeatureCount: 0,
      completedOrder: ++completedOrder,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const runUser = async (index) => [
  ...(await Promise.all([
    runRequest(index, "default"),
    runRequest(index, "weighted"),
  ])),
];

const userIndexes = Array.from({ length: count }, (_, index) => index + 1).sort(
  () => Math.random() - 0.5
);

console.log(`Accessibility load test: ${count} parallel users -> ${baseUrl} (${city})`);
console.log(`Each user runs default and weighted requests together with Hamburg factors=${Object.keys(hamburgWeightedParams).length}`);

const results = (await Promise.all(
  userIndexes.map((index) => runUser(index))
)).flat();

const endToEndValues = results.map((row) => row.endToEndMs);
const failed = results.filter((row) => !row.ok);

console.table(
  results.map((row) => ({
    user: row.index,
    mode: row.mode,
    ok: row.ok,
    status: row.httpStatus,
    endToEndMs: row.endToEndMs,
    queueWaitMs: row.queueWaitMs,
    queuePos: row.queuePositionAtEnqueue,
    completedOrder: row.completedOrder,
    apiTotalMs: row.apiTotalMs,
    routingMs: row.routingQueryMs,
    polygonFeatures: row.polygonFeatureCount,
    networkFeatures: row.clientNetworkFeatureCount,
    payloadKB: round(row.payloadBytes / 1024),
    error: row.error,
  }))
);

console.log("Summary");
console.table([
  {
    users: count,
    requests: results.length,
    succeeded: results.length - failed.length,
    failed: failed.length,
    minEndToEndMs: round(Math.min(...endToEndValues)),
    p50EndToEndMs: round(percentile(endToEndValues, 50)),
    p95EndToEndMs: round(percentile(endToEndValues, 95)),
    maxEndToEndMs: round(Math.max(...endToEndValues)),
  },
]);

if (failed.length > 0) {
  console.log("Failed requests");
  console.table(
    failed.map((row) => ({
      user: row.index,
      mode: row.mode,
      requestId: row.requestId,
      status: row.httpStatus,
      queuePos: row.queuePositionAtEnqueue,
      endToEndMs: row.endToEndMs,
      error: row.error,
    }))
  );
}
