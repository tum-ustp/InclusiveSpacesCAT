import * as turf from "@turf/turf";

export const markPerformance = (name) => {
  if (typeof performance === "undefined" || !performance.mark) return;
  performance.mark(name);
};

export const measurePerformance = (name, startMark, endMark) => {
  if (typeof performance === "undefined" || !performance.measure) return 0;
  performance.measure(name, startMark, endMark);
  const latestEntry = performance.getEntriesByName(name).at(-1);
  return Number((latestEntry?.duration || 0).toFixed(2));
};

export const countCoordinates = (geojson) => {
  const countGeometryCoordinates = (geometry) => {
    if (!geometry?.coordinates) return 0;

    const walk = (coords) => {
      if (!Array.isArray(coords)) return 0;
      if (typeof coords[0] === "number") return 1;
      return coords.reduce((sum, part) => sum + walk(part), 0);
    };

    return walk(geometry.coordinates);
  };

  if (Array.isArray(geojson)) {
    return geojson.reduce(
      (sum, feature) => sum + countGeometryCoordinates(feature?.geometry),
      0
    );
  }

  if (geojson?.type === "FeatureCollection") {
    return geojson.features.reduce(
      (sum, feature) => sum + countGeometryCoordinates(feature?.geometry),
      0
    );
  }

  if (geojson?.type === "Feature") {
    return countGeometryCoordinates(geojson.geometry);
  }

  return countGeometryCoordinates(geojson);
};

export const buildBufferedAreaWithTiming = (roads, bufferDistance, contourSettings, phaseLabel) => {
  const runId = `${phaseLabel}-${Date.now()}`;

  const combineStart = `accessibility-combine-start-${runId}`;
  const combineEnd = `accessibility-combine-end-${runId}`;
  markPerformance(combineStart);
  const fc = turf.featureCollection(roads);
  const combined = turf.combine(fc);
  markPerformance(combineEnd);
  const combineMs = measurePerformance(
    `accessibility:turf:combine:${phaseLabel}`,
    combineStart,
    combineEnd
  );

  const simplifyStart = `accessibility-simplify-start-${runId}`;
  const simplifyEnd = `accessibility-simplify-end-${runId}`;
  markPerformance(simplifyStart);
  const simplified = turf.simplify(combined, {
    tolerance: contourSettings.tolerance,
    highQuality: contourSettings.highQuality
  });
  markPerformance(simplifyEnd);
  const simplifyMs = measurePerformance(
    `accessibility:turf:simplify:${phaseLabel}`,
    simplifyStart,
    simplifyEnd
  );

  const bufferStart = `accessibility-buffer-start-${runId}`;
  const bufferEnd = `accessibility-buffer-end-${runId}`;
  markPerformance(bufferStart);
  const buffered = turf.buffer(simplified, bufferDistance, {
    units: "kilometers",
    steps: contourSettings.steps
  });
  markPerformance(bufferEnd);
  const bufferMs = measurePerformance(
    `accessibility:turf:buffer:${phaseLabel}`,
    bufferStart,
    bufferEnd
  );

  const areaStart = `accessibility-area-start-${runId}`;
  const areaEnd = `accessibility-area-end-${runId}`;
  markPerformance(areaStart);
  const cleaned = {
    type: "FeatureCollection",
    features: buffered.features.map((f) => {
      if (f.geometry.type === "Polygon") {
        return turf.polygon([f.geometry.coordinates[0]]);
      }
      if (f.geometry.type === "MultiPolygon") {
        return turf.multiPolygon(f.geometry.coordinates.map((p) => [p[0]]));
      }
      return f;
    })
  };

  let areaSquareMeters = 0;
  cleaned.features.forEach((feature) => {
    areaSquareMeters += turf.area(feature);
  });
  markPerformance(areaEnd);
  const areaMs = measurePerformance(
    `accessibility:turf:area:${phaseLabel}`,
    areaStart,
    areaEnd
  );

  const turfProcessingMs = Number((combineMs + simplifyMs + bufferMs + areaMs).toFixed(2));

  return {
    cleaned,
    areaHectares: areaSquareMeters / 10000,
    timings: {
      combineMs,
      simplifyMs,
      bufferMs,
      areaMs,
      turfProcessingMs,
    },
  };
};

export const logAccessibilityTiming = (phaseLabel, requestTiming, turfTiming, inputGeometryStats) => {
  const serverTiming = requestTiming?.serverTiming || {};
  const fetchAndParseMs = Number((requestTiming?.fetchAndParseMs || 0).toFixed(2));
  const apiTotalMs = Number((serverTiming.apiTotalMs || 0).toFixed(2));
  const nearestVertexMs = Number((serverTiming.nearestVertexMs || 0).toFixed(2));
  const routingQueryMs = Number(
    (serverTiming.routingQueryMs ?? serverTiming.pgrDrivingDistanceMs ?? 0).toFixed(2)
  );
  const apiOverheadMs = Number(
    (serverTiming.apiOverheadMs ?? Math.max(0, apiTotalMs - nearestVertexMs - routingQueryMs)).toFixed(2)
  );
  const networkAndBrowserParseMs = Math.max(0, Number((fetchAndParseMs - apiTotalMs).toFixed(2)));
  const turfProcessingMs = Number((turfTiming?.turfProcessingMs || 0).toFixed(2));
  const postServerToClientReadyMs = Number(
    (networkAndBrowserParseMs + turfProcessingMs).toFixed(2)
  );
  const serverFeatureCount = Number(serverTiming.featureCount || 0);
  const serverRawCoordinateCount = Number(serverTiming.rawCoordinateCount || 0);
  const serverOutputCoordinateCount = Number(serverTiming.outputCoordinateCount || 0);
  const responseBytes = Number(serverTiming.responseBytes || 0);

  console.groupCollapsed(`[accessibility timing] ${phaseLabel}`);
  console.table({
    geometryMode: serverTiming.geometryMode || "full",
    routingQueryMs,
    apiOverheadMs,
    nearestVertexMs,
    apiTotalMs,
    fetchAndParseMs,
    networkAndBrowserParseMs,
    postServerToClientReadyMs,
    serverFeatureCount,
    serverRawCoordinateCount,
    serverOutputCoordinateCount,
    responseBytes,
    clientFeatureCount: inputGeometryStats?.featureCount || 0,
    clientCoordinateCount: inputGeometryStats?.coordinateCount || 0,
    combineMs: Number((turfTiming?.combineMs || 0).toFixed(2)),
    simplifyMs: Number((turfTiming?.simplifyMs || 0).toFixed(2)),
    bufferMs: Number((turfTiming?.bufferMs || 0).toFixed(2)),
    areaMs: Number((turfTiming?.areaMs || 0).toFixed(2)),
    turfProcessingMs,
    endToEndMs: Number((fetchAndParseMs + turfProcessingMs).toFixed(2)),
  });
  console.groupEnd();
};

export const getContourSettings = (featureCount) => {
  if (featureCount > 4000) {
    return { tolerance: 0.00014, highQuality: false, steps: 12 };
  }
  if (featureCount > 1500) {
    return { tolerance: 0.0001, highQuality: false, steps: 14 };
  }
  return { tolerance: 0.00007, highQuality: true, steps: 16 };
};
