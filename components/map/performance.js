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

const stripInteriorRings = (feature) => {
  if (feature?.geometry?.type === "Polygon") {
    return turf.polygon([feature.geometry.coordinates[0]], feature.properties);
  }

  if (feature?.geometry?.type === "MultiPolygon") {
    return turf.multiPolygon(
      feature.geometry.coordinates.map((polygon) => [polygon[0]]),
      feature.properties
    );
  }

  return feature;
};

const isValidPosition = (position) =>
  Array.isArray(position) &&
  position.length >= 2 &&
  Number.isFinite(position[0]) &&
  Number.isFinite(position[1]);

const cleanLineCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates)) return [];

  const cleaned = [];
  for (const position of coordinates) {
    if (!isValidPosition(position)) continue;
    const previous = cleaned[cleaned.length - 1];
    if (previous && previous[0] === position[0] && previous[1] === position[1]) continue;
    cleaned.push(position);
  }

  return cleaned.length >= 2 ? cleaned : [];
};

const normalizeRoadFeature = (feature) => {
  const geometry = feature?.geometry;
  const properties = feature?.properties;

  if (geometry?.type === "LineString") {
    const coordinates = cleanLineCoordinates(geometry.coordinates);
    return coordinates.length >= 2 ? turf.lineString(coordinates, properties) : null;
  }

  if (geometry?.type === "MultiLineString") {
    const lines = geometry.coordinates
      .map(cleanLineCoordinates)
      .filter((coordinates) => coordinates.length >= 2);

    if (lines.length === 0) return null;
    return lines.length === 1
      ? turf.lineString(lines[0], properties)
      : turf.multiLineString(lines, properties);
  }

  return null;
};

const normalizeRoadFeatures = (roads) =>
  Array.isArray(roads) ? roads.map(normalizeRoadFeature).filter(Boolean) : [];

const getFeatures = (geojson) => {
  if (geojson?.type === "FeatureCollection") return geojson.features || [];
  if (geojson?.type === "Feature") return [geojson];
  return [];
};

const isPolygonFeature = (feature) =>
  feature?.geometry?.type === "Polygon" ||
  feature?.geometry?.type === "MultiPolygon";

const flattenPolygonFeatures = (features) =>
  turf.flatten(turf.featureCollection(features.filter(isPolygonFeature))).features
    .filter(isPolygonFeature);

const unionPolygonFeatures = (features) => {
  const flattened = flattenPolygonFeatures(features);

  if (flattened.length === 0) return null;
  if (flattened.length === 1) return flattened[0];

  return turf.union(turf.featureCollection(flattened));
};

const polygonBoundaryLines = (feature) => {
  const boundary = turf.polygonToLine(feature);

  if (boundary?.type === "FeatureCollection") return boundary.features;
  return boundary ? [boundary] : [];
};

const fillClosedFacesFromBufferBoundaries = (features) => {
  const polygonParts = flattenPolygonFeatures(features);

  if (polygonParts.length === 0) return [];

  try {
    const boundaryLines = polygonParts.flatMap(polygonBoundaryLines);
    const faces = turf.polygonize(turf.featureCollection(boundaryLines));
    const filled = unionPolygonFeatures([...polygonParts, ...faces.features]);

    return filled ? [stripInteriorRings(filled)] : polygonParts.map(stripInteriorRings);
  } catch (err) {
    console.warn("Failed to fill closed buffered faces:", err);
    return polygonParts.map(stripInteriorRings);
  }
};

const buildSolidBufferedFeatures = (buffered) => {
  const polygonFeatures = getFeatures(buffered).filter(isPolygonFeature);

  if (polygonFeatures.length === 0) return [];

  try {
    return fillClosedFacesFromBufferBoundaries(polygonFeatures);
  } catch (err) {
    console.warn("Failed to merge buffered reachability geometry:", err);
    return polygonFeatures.map(stripInteriorRings);
  }
};

const calculateAreaSquareMeters = (features) => {
  if (features.length === 0) return 0;

  return features.reduce((sum, feature) => sum + turf.area(feature), 0);
};

export const buildBufferedAreaWithTiming = (roads, bufferDistance, contourSettings, phaseLabel) => {
  const runId = `${phaseLabel}-${Date.now()}`;
  const roadFeatures = normalizeRoadFeatures(roads);

  if (roadFeatures.length === 0) {
    return {
      cleaned: {
        type: "FeatureCollection",
        features: [],
      },
      areaHectares: 0,
      timings: {
        combineMs: 0,
        simplifyMs: 0,
        bufferMs: 0,
        areaMs: 0,
        turfProcessingMs: 0,
      },
    };
  }

  const combineStart = `accessibility-combine-start-${runId}`;
  const combineEnd = `accessibility-combine-end-${runId}`;
  markPerformance(combineStart);
  const combined = roadFeatures.length === 1
    ? roadFeatures[0]
    : turf.combine(turf.featureCollection(roadFeatures));
  markPerformance(combineEnd);
  const combineMs = measurePerformance(
    `accessibility:turf:combine:${phaseLabel}`,
    combineStart,
    combineEnd
  );

  const simplifyStart = `accessibility-simplify-start-${runId}`;
  const simplifyEnd = `accessibility-simplify-end-${runId}`;
  markPerformance(simplifyStart);
  let simplified = combined;
  if (roadFeatures.length > 1) {
    try {
      simplified = turf.simplify(combined, {
        tolerance: contourSettings.tolerance,
        highQuality: contourSettings.highQuality
      });
    } catch (err) {
      console.warn("Failed to simplify reachability roads; buffering cleaned lines instead:", err);
    }
  }
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
    features: buildSolidBufferedFeatures(buffered)
  };

  const areaSquareMeters = calculateAreaSquareMeters(cleaned.features);
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
    frontierDepthMeters: Number(serverTiming.frontierDepthMeters || 0),
    frontierInnerStreetPadding: Number(serverTiming.frontierInnerStreetPadding || 0),
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
    return { tolerance: 0.00018, highQuality: false, steps: 8 };
  }
  if (featureCount > 1500) {
    return { tolerance: 0.00014, highQuality: false, steps: 8 };
  }
  return { tolerance: 0.0001, highQuality: false, steps: 10 };
};
