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

const isLinearRing = (ring) =>
  Array.isArray(ring) &&
  ring.length >= 4 &&
  ring.every(
    (point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1])
  );

const toOuterPolygonFeature = (feature) => {
  const geometry = feature?.geometry;
  if (!Array.isArray(geometry?.coordinates)) return null;

  if (geometry.type === "Polygon") {
    const outerRing = geometry.coordinates[0];
    return isLinearRing(outerRing) ? turf.polygon([outerRing]) : null;
  }

  if (geometry.type === "MultiPolygon") {
    const polygons = geometry.coordinates
      .map((polygon) => polygon?.[0])
      .filter(isLinearRing)
      .map((outerRing) => [outerRing]);

    return polygons.length ? turf.multiPolygon(polygons) : null;
  }

  return null;
};

const measureArea = (features) =>
  features.reduce((sum, feature) => {
    try {
      return sum + turf.area(feature);
    } catch (err) {
      console.warn("Skipping invalid buffered area feature", err);
      return sum;
    }
  }, 0);

export const buildBufferedAreaWithTiming = (roads) => {
  const inputFeatures = Array.isArray(roads) ? roads : [];
  const cleaned = {
    type: "FeatureCollection",
    features: inputFeatures.map(toOuterPolygonFeature).filter(Boolean)
  };

  return {
    cleaned,
    areaHectares: measureArea(cleaned.features) / 10000,
  };
};

export const logAccessibilityTiming = (phaseLabel, requestTiming, inputGeometryStats) => {
  const row = getAccessibilityTimingRow(phaseLabel, requestTiming, inputGeometryStats);

  console.groupCollapsed(`[accessibility timing] ${phaseLabel}`);
  console.table(row);
  console.groupEnd();
};

export const getAccessibilityTimingRow = (phaseLabel, requestTiming, inputGeometryStats) => {
  const serverTiming = requestTiming?.serverTiming || {};
  const fetchAndParseMs = Number((requestTiming?.fetchAndParseMs || 0).toFixed(2));
  const apiTotalMs = Number((serverTiming.apiTotalMs || 0).toFixed(2));
  const totalServerMs = Number((serverTiming.totalServerMs ?? serverTiming.apiTotalMs ?? 0).toFixed(2));
  const nearestVertexMs = Number((serverTiming.nearestVertexMs || 0).toFixed(2));
  const routingQueryMs = Number(
    (serverTiming.routingQueryMs ?? serverTiming.pgrDrivingDistanceMs ?? 0).toFixed(2)
  );
  const reachableEdgeSelectionMs = Number((serverTiming.reachableEdgeSelectionMs || 0).toFixed(2));
  const geometryUnionMs = Number((serverTiming.geometryUnionMs || 0).toFixed(2));
  const geometrySimplificationMs = Number((serverTiming.geometrySimplificationMs || 0).toFixed(2));
  const geoJsonSerializationMs = Number((serverTiming.geoJsonSerializationMs || 0).toFixed(2));
  const apiOverheadMs = Number(
    (serverTiming.apiOverheadMs ?? Math.max(0, apiTotalMs - nearestVertexMs - routingQueryMs)).toFixed(2)
  );
  const queueWaitMs = Number((serverTiming.queueWaitMs || 0).toFixed(2));
  const queuePositionAtEnqueue = Number(serverTiming.queuePositionAtEnqueue || 0);
  const networkAndBrowserParseMs = Math.max(0, Number((fetchAndParseMs - apiTotalMs).toFixed(2)));
  const serverFeatureCount = Number(serverTiming.featureCount || 0);
  const serverRawCoordinateCount = Number(serverTiming.rawCoordinateCount || 0);
  const serverOutputCoordinateCount = Number(serverTiming.outputCoordinateCount || 0);
  const polygonFeatureCount = Number(serverTiming.polygonFeatureCount || 0);
  const polygonCoordinateCount = Number(serverTiming.polygonCoordinateCount || 0);
  const polygonBytes = Number(serverTiming.polygonBytes || 0);
  const networkBytes = Number(serverTiming.networkBytes || 0);
  const payloadBytes = Number(serverTiming.payloadBytes ?? serverTiming.responseBytes ?? 0);

  return {
    phaseLabel,
    geometryMode: serverTiming.geometryMode || "full",
    queueWaitMs,
    queuePositionAtEnqueue,
    routingQueryMs,
    reachableEdgeSelectionMs,
    geometryUnionMs,
    geometrySimplificationMs,
    geoJsonSerializationMs,
    apiOverheadMs,
    nearestVertexMs,
    apiTotalMs,
    totalServerMs,
    fetchAndParseMs,
    networkAndBrowserParseMs,
    serverFeatureCount,
    serverRawCoordinateCount,
    serverOutputCoordinateCount,
    polygonFeatureCount,
    polygonCoordinateCount,
    polygonBytes,
    networkBytes,
    payloadBytes,
    clientPolygonFeatureCount: inputGeometryStats?.polygonFeatureCount || 0,
    clientPolygonCoordinateCount: inputGeometryStats?.polygonCoordinateCount || 0,
    clientNetworkFeatureCount: inputGeometryStats?.networkFeatureCount || 0,
    clientNetworkCoordinateCount: inputGeometryStats?.networkCoordinateCount || 0,
    endToEndMs: Number(fetchAndParseMs.toFixed(2)),
  };
};
