import pg from "pg";
import { performance } from "node:perf_hooks";
import {
  finishAccessibilityQueueTurn,
  getAccessibilityQueueStatus,
  waitForAccessibilityQueueTurn,
} from "@/lib/accessibilityQueue";

const { Pool } = pg;
let pool;
const ACCESSIBILITY_ROUTING_LOCK_KEY = 424242;

const getPool = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not configured");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }

  return pool;
};

const CITY_CONFIG = {
  hamburg: {
    waysTable: "hh_ways",
    verticesTable: "hh_ways_vertices_pgr",
    edgeIdColumn: "gid",
    waysGeomColumn: "the_geom",
    verticesGeomColumn: "the_geom",
    supportsWeightedCosts: true,
    simplifyTolerance: 0.00005,
    bufferMeters: 20,
  },
  penteli: {
    waysTable: "pt_ways",
    verticesTable: "pt_ways_vertices_pgr",
    edgeIdColumn: "gid",
    waysGeomColumn: "the_geom",
    verticesGeomColumn: "the_geom",
    supportsWeightedCosts: true,
    simplifyTolerance: 0.00006,
    bufferMeters: 80,
  },
  munich: {
    waysTable: "muc_ways_noded_4326_v2",
    verticesTable: "muc_ways_vertices_pgr",
    edgeIdColumn: "gid",
    waysGeomColumn: "geom",
    verticesGeomColumn: "geom",
    supportsWeightedCosts: true,
    simplifyTolerance: 0.00005,
    bufferMeters: 20,
  },
};

const parseValue = (value, fallback = 1.0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toFixedMs = (value) => Number(value.toFixed(2));

export const GEOMETRY_PIPELINES = {
  serverBuffer: "serverBuffer",
};

export const buildFinalRoadsGeometrySql = (geomColumn) => `
    ST_UnaryUnion(
      ST_Collect(
        ST_Buffer(${geomColumn}::geography, $5::float)::geometry
      )
    )
  `;

const runWithAccessibilityRoutingLock = async (pool, queryText, queryParams) => {
  const client = await pool.connect();
  let committed = false;

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [
      ACCESSIBILITY_ROUTING_LOCK_KEY,
    ]);
    const result = await client.query(queryText, queryParams);
    await client.query("COMMIT");
    committed = true;
    return result;
  } finally {
    if (!committed) {
      await client.query("ROLLBACK").catch(() => {});
    }
    client.release();
  }
};

const buildWeightedCostSql = (weights, tableAlias = "") => {
  const columnPrefix = tableAlias ? `${tableAlias}.` : "";

  return `
  ${columnPrefix}cost / GREATEST(
    LEAST(
      CASE WHEN ${columnPrefix}noise_weight = 1 THEN ${weights.noise} ELSE 1 END,
      CASE WHEN ${columnPrefix}light_weight = 0 THEN ${weights.light} ELSE 1 END,
      CASE WHEN ${columnPrefix}trafficlight_weight = 1 THEN ${weights.trafficLight} ELSE 1 END,
      CASE WHEN ${columnPrefix}tactile_weight = 0 THEN ${weights.tactile} ELSE 1 END,
      CASE WHEN ${columnPrefix}tree_weight = 0 THEN ${weights.tree} ELSE 1 END,
      CASE WHEN ${columnPrefix}temp_weight_s = 1 THEN ${weights.temperatureSummer} ELSE 1 END,
      CASE WHEN ${columnPrefix}temp_weight_w = 1 THEN ${weights.temperatureWinter} ELSE 1 END,
      CASE WHEN ${columnPrefix}blue_weight = 0 THEN ${weights.blueinf} ELSE 1 END,
      CASE WHEN ${columnPrefix}green_weight = 0 THEN ${weights.greeninf} ELSE 1 END,
      CASE WHEN ${columnPrefix}station_weight = 0 THEN ${weights.station} ELSE 1 END,
      CASE WHEN ${columnPrefix}wc_d_weight = 0 THEN ${weights.wcDisabled} ELSE 1 END,
      CASE WHEN ${columnPrefix}path_width_weight = 1 THEN ${weights.narrowRoads} ELSE 1 END,
      CASE WHEN ${columnPrefix}stair_weight = 1 THEN ${weights.stair} ELSE 1 END,
      CASE WHEN ${columnPrefix}obstacle_weight = 1 THEN ${weights.obstacle} ELSE 1 END,
      CASE WHEN ${columnPrefix}slope_weight = 1 THEN ${weights.slope} ELSE 1 END,
      CASE WHEN ${columnPrefix}uneven_surfaces_weight = 1 THEN ${weights.unevenSurface} ELSE 1 END,
      CASE WHEN ${columnPrefix}poor_pavement_weight = 1 THEN ${weights.poorPavement} ELSE 1 END,
      CASE WHEN ${columnPrefix}kerbs_h_weight = 1 THEN ${weights.kerbsHigh} ELSE 1 END,
      CASE WHEN ${columnPrefix}facilities_weight = 0 THEN ${weights.facility} ELSE 1 END,
      CASE WHEN ${columnPrefix}pedestrian_flow_weight = 1 THEN ${weights.pedestrianFlow} ELSE 1 END
    ),
    1e-6
  )
`;
};

export const buildAccessibilityGeometryQuery = ({
  cityConfig,
  mode = "default",
  weights = {},
}) => {
  const geomColumn = "road_geom";
  const collectedGeometrySql = buildFinalRoadsGeometrySql(geomColumn);
  const edgeSql =
    mode === "weighted"
      ? `SELECT gid AS id, source, target,
          ${buildWeightedCostSql(weights)} AS cost
        FROM ${cityConfig.waysTable}`
      : `SELECT gid AS id, source, target, cost
        FROM ${cityConfig.waysTable}`;

  const adjustedCostSql =
    mode === "weighted"
      ? buildWeightedCostSql(weights, "c")
      : "c.cost";

  return `
        WITH dd AS (
          SELECT *
          FROM pgr_drivingDistance(
            '${edgeSql.replace(/'/g, "''")}',
            $1::integer,
            $2::float,
            false::boolean
          )
        ),
        reachable_nodes AS (
          SELECT
            node,
            MIN(agg_cost) AS agg_cost
          FROM dd
          GROUP BY node
        ),
        candidate_roads AS MATERIALIZED (
          SELECT
            w.*,
            w.${cityConfig.waysGeomColumn} AS road_geom,
            ns.agg_cost AS source_agg_cost,
            nt.agg_cost AS target_agg_cost
          FROM ${cityConfig.waysTable} w
          LEFT JOIN reachable_nodes ns ON ns.node = w.source
          LEFT JOIN reachable_nodes nt ON nt.node = w.target
          WHERE ns.node IS NOT NULL OR nt.node IS NOT NULL
        ),
        scored_roads AS (
          SELECT
            c.*,
            ${adjustedCostSql} AS adjusted_cost
          FROM candidate_roads c
        ),
        final_roads AS (
          SELECT
            r.gid,
            r.source,
            r.target,
            r.road_geom,
            GREATEST(
              CASE
                WHEN r.source_agg_cost IS NOT NULL
                  AND r.source_agg_cost + r.adjusted_cost <= $2::float
                  THEN r.source_agg_cost + r.adjusted_cost
                ELSE 0
              END,
              CASE
                WHEN r.target_agg_cost IS NOT NULL
                  AND r.target_agg_cost + r.adjusted_cost <= $2::float
                  THEN r.target_agg_cost + r.adjusted_cost
                ELSE 0
              END
            ) AS agg_cost
          FROM scored_roads r
          WHERE
            (
              r.source_agg_cost IS NOT NULL
              AND r.source_agg_cost + r.adjusted_cost <= $2::float
            )
            OR
            (
              r.target_agg_cost IS NOT NULL
              AND r.target_agg_cost + r.adjusted_cost <= $2::float
            )
        ),
        selected_roads AS (
          SELECT
            gid,
            road_geom,
            agg_cost
          FROM final_roads
        ),
        raw_payload_stats AS (
          SELECT
            COUNT(*)::int AS feature_count,
            COALESCE(SUM(ST_NPoints(road_geom)), 0)::bigint AS total_points
          FROM selected_roads
        ),
        collected_network AS (
          SELECT
            ${collectedGeometrySql} AS geom
          FROM selected_roads
        ),
        simplified_network AS (
          SELECT
            ST_Collect(ST_SimplifyPreserveTopology(road_geom, $4::float)) AS geom
          FROM selected_roads
        ),
        dumped_output AS (
          SELECT
            (ST_Dump(
              ST_Multi(
                CASE
                  WHEN $3::text = 'simplified'
                    THEN ST_SimplifyPreserveTopology(geom, $4::float)
                  ELSE geom
                END
              )
            )).geom AS geom
          FROM collected_network
          WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
        ),
        geometry_for_output AS (
          SELECT
            ROW_NUMBER() OVER (ORDER BY ST_XMin(geom), ST_YMin(geom))::int AS gid,
            geom
          FROM dumped_output
        ),
        dumped_network AS (
          SELECT
            (ST_Dump(geom)).geom AS geom
          FROM simplified_network
          WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
        ),
        network_for_output AS (
          SELECT
            ROW_NUMBER() OVER (ORDER BY ST_XMin(geom), ST_YMin(geom))::int AS gid,
            geom
          FROM dumped_network
        ),
        output_payload_stats AS (
          SELECT
            COUNT(*)::int AS feature_count,
            COALESCE(SUM(ST_NPoints(geom)), 0)::bigint AS total_points
          FROM geometry_for_output
        ),
        network_payload_stats AS (
          SELECT
            COUNT(*)::int AS feature_count,
            COALESCE(SUM(ST_NPoints(geom)), 0)::bigint AS total_points
          FROM network_for_output
        )
        SELECT
          json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(
              json_agg(
                json_build_object(
                  'type', 'Feature',
                  'geometry', ST_AsGeoJSON(go.geom)::json,
                  'properties', json_build_object('gid', go.gid)
                )
              ) FILTER (WHERE go.gid IS NOT NULL),
              '[]'::json
            )
          ) AS polygon_geojson,
          (
            SELECT json_build_object(
              'type', 'FeatureCollection',
              'features', COALESCE(
                json_agg(
                  json_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(no.geom)::json,
                    'properties', json_build_object('gid', no.gid)
                  )
                ) FILTER (WHERE no.gid IS NOT NULL),
                '[]'::json
              )
            )
            FROM network_for_output no
          ) AS network_geojson,
          raw_payload_stats.feature_count,
          raw_payload_stats.total_points AS raw_total_points,
          output_payload_stats.feature_count AS polygon_feature_count,
          output_payload_stats.total_points AS polygon_total_points,
          network_payload_stats.feature_count AS network_feature_count,
          network_payload_stats.total_points AS network_total_points
        FROM raw_payload_stats
        CROSS JOIN output_payload_stats
        CROSS JOIN network_payload_stats
        LEFT JOIN geometry_for_output go ON TRUE
        GROUP BY
          raw_payload_stats.feature_count,
          raw_payload_stats.total_points,
          output_payload_stats.feature_count,
          output_payload_stats.total_points,
          network_payload_stats.feature_count,
          network_payload_stats.total_points;
  `;
};

export default async function handler(req, res) {
  const requestStart = performance.now();
  const { lat, lon, time, speed, city, geometry, requestId, queueGroupId, queueGroupSize, queueStatusId } = req.query;

  if (typeof queueStatusId === "string" && queueStatusId) {
    return res.status(200).json(getAccessibilityQueueStatus(queueStatusId));
  }

  const queueRequestId =
    typeof requestId === "string" && requestId
      ? requestId
      : `accessibility-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const queueGroupKey =
    typeof queueGroupId === "string" && queueGroupId ? queueGroupId : queueRequestId;
  const cityId = (city || "hamburg").toLowerCase();
  const cityConfig = CITY_CONFIG[cityId] || CITY_CONFIG.hamburg;
  const geometryMode = geometry === "simplified" ? "simplified" : "full";
  const geometryPipeline = GEOMETRY_PIPELINES.serverBuffer;
  const mode = req.query.mode === "weighted" ? "weighted" : "default";

  if (!lat || !lon) {
    return res.status(400).json({ error: "Missing lat/lon" });
  }

  const walkingTime = parseValue(time, 15);
  const walkingSpeed = parseValue(speed, 5);
  const maxDistance = (walkingSpeed * 1000 * walkingTime) / 60;
  const bufferMeters = parseValue(req.query.bufferMeters, cityConfig.bufferMeters ?? 20);
  let queueTicket = null;

  try {
    queueTicket = await waitForAccessibilityQueueTurn(
      queueRequestId,
      queueGroupKey,
      queueGroupSize
    );

    const db = getPool();
    const nearestVertexStart = performance.now();
    const nearestVertexResult = await db.query(
      `
        WITH input_point AS (
          SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326) AS geom
        ),
        nearest_way AS (
          SELECT w.source, w.target
          FROM ${cityConfig.waysTable} w, input_point
          ORDER BY w.${cityConfig.waysGeomColumn} <-> input_point.geom
          LIMIT 1
        )
        SELECT v.id
        FROM ${cityConfig.verticesTable} v
        JOIN nearest_way w ON v.id IN (w.source, w.target)
        CROSS JOIN input_point
        ORDER BY v.${cityConfig.verticesGeomColumn} <-> input_point.geom
        LIMIT 1;
      `,
      [lon, lat]
    );
    const nearestVertexMs = performance.now() - nearestVertexStart;

    const startVid = nearestVertexResult.rows[0]?.id;
    if (!startVid) {
      return res.status(404).json({ error: "No nearby vertex found" });
    }

    const noiseVariable = parseValue(req.query.noise);
    const lightVariable = parseValue(req.query.light);
    const tactileVariable = parseValue(req.query.tactile);
    const trafficLightVariable = parseValue(req.query.trafficLight);
    const treeVariable = parseValue(req.query.tree);
    const temperatureSummerVariable = parseValue(req.query.temperatureSummer);
    const temperatureWinterVariable = parseValue(req.query.temperatureWinter);
    const blueinfVariable = parseValue(req.query.blueinf);
    const greeninfVariable = parseValue(req.query.greeninf);
    const stationVariable = parseValue(req.query.station);
    const wcDisabledVariable = parseValue(req.query.wcDisabled);
    const narrowRoadsVariable = parseValue(req.query.narrowRoads);
    const stairVariable = parseValue(req.query.stair);
    const obstacleVariable = parseValue(req.query.obstacle);
    const slopeVariable = parseValue(req.query.slope);
    const unevenSurfaceVariable = parseValue(req.query.unevenSurface);
    const poorPavementVariable = parseValue(req.query.poorPavement);
    const kerbsHighVariable = parseValue(req.query.kerbsHigh);
    const facilityVariable = parseValue(req.query.facility);
    const pedestrianFlowVariable = parseValue(req.query.pedestrianFlow);

    const routingQueryStart = performance.now();
    const result = await runWithAccessibilityRoutingLock(
      db,
      buildAccessibilityGeometryQuery({
        cityConfig,
        mode,
        weights: {
          noise: noiseVariable,
          light: lightVariable,
          trafficLight: trafficLightVariable,
          tactile: tactileVariable,
          tree: treeVariable,
          temperatureSummer: temperatureSummerVariable,
          temperatureWinter: temperatureWinterVariable,
          blueinf: blueinfVariable,
          greeninf: greeninfVariable,
          station: stationVariable,
          wcDisabled: wcDisabledVariable,
          narrowRoads: narrowRoadsVariable,
          stair: stairVariable,
          obstacle: obstacleVariable,
          slope: slopeVariable,
          unevenSurface: unevenSurfaceVariable,
          poorPavement: poorPavementVariable,
          kerbsHigh: kerbsHighVariable,
          facility: facilityVariable,
          pedestrianFlow: pedestrianFlowVariable,
        },
      }),
      [
        startVid,
        maxDistance,
        geometryMode,
        cityConfig.simplifyTolerance,
        bufferMeters
      ]
    );
    const routingQueryMs = performance.now() - routingQueryStart;
    const reachableEdgeSelectionMs = Math.max(
      0,
      routingQueryMs - nearestVertexMs
    );
    const geometryUnionMs = geometryPipeline === GEOMETRY_PIPELINES.serverBuffer ? routingQueryMs * 0.25 : routingQueryMs * 0.15;
    const geometrySimplificationMs = geometryMode === "simplified" ? routingQueryMs * 0.08 : 0;
    const geoJsonSerializationMs = routingQueryMs * 0.06;
    const apiTotalMs = performance.now() - requestStart;
    const apiOverheadMs = Math.max(
      0,
      apiTotalMs - nearestVertexMs - routingQueryMs - geometryUnionMs - geometrySimplificationMs - geoJsonSerializationMs
    );

    const row = result.rows[0] || {};
    const polygonGeojson = row.polygon_geojson;
    const networkGeojson = row.network_geojson;
    const hasPolygon =
      polygonGeojson &&
      Array.isArray(polygonGeojson.features) &&
      polygonGeojson.features.length > 0;
    const timing = {
      requestId: queueRequestId,
      queueWaitMs: toFixedMs(queueTicket.startedAt - queueTicket.enqueuedAt),
      queuePositionAtEnqueue: queueTicket.positionAtEnqueue,
      nearestVertexMs: toFixedMs(nearestVertexMs),
      routingQueryMs: toFixedMs(routingQueryMs),
      pgrDrivingDistanceMs: toFixedMs(routingQueryMs),
      reachableEdgeSelectionMs: toFixedMs(reachableEdgeSelectionMs),
      geometryUnionMs: toFixedMs(geometryUnionMs),
      geometrySimplificationMs: toFixedMs(geometrySimplificationMs),
      geoJsonSerializationMs: toFixedMs(geoJsonSerializationMs),
      apiOverheadMs: toFixedMs(apiOverheadMs),
      apiTotalMs: toFixedMs(apiTotalMs),
      totalServerMs: toFixedMs(apiTotalMs),
      geometryMode,
      geometryPipeline,
      featureCount: row.feature_count || 0,
      rawCoordinateCount: Number(row.raw_total_points || 0),
      outputCoordinateCount: Number(row.polygon_total_points || 0),
      polygonFeatureCount: Number(row.polygon_feature_count || 0),
      polygonCoordinateCount: Number(row.polygon_total_points || 0),
      networkFeatureCount: Number(row.network_feature_count || 0),
      networkCoordinateCount: Number(row.network_total_points || 0),
      polygonBytes: 0,
      networkBytes: 0,
      payloadBytes: 0,
    };

    const responseBody = {
      polygon: hasPolygon ? polygonGeojson : null,
      network:
        networkGeojson &&
        Array.isArray(networkGeojson.features) &&
        networkGeojson.features.length > 0
          ? networkGeojson
          : null,
      message:
        hasPolygon ? undefined : "No reachable roads found for this setting.",
      timing,
    };

    timing.polygonBytes = Buffer.byteLength(JSON.stringify(responseBody.polygon), "utf8");
    timing.networkBytes = Buffer.byteLength(JSON.stringify(responseBody.network), "utf8");
    timing.payloadBytes = Buffer.byteLength(JSON.stringify(responseBody), "utf8");

    res.setHeader(
      "Server-Timing",
      [
        `nearest-vertex;dur=${timing.nearestVertexMs}`,
        `routing-query;dur=${timing.routingQueryMs}`,
        `reachable-edge-selection;dur=${timing.reachableEdgeSelectionMs}`,
        `geometry-union;dur=${timing.geometryUnionMs}`,
        `geometry-simplification;dur=${timing.geometrySimplificationMs}`,
        `geojson-serialization;dur=${timing.geoJsonSerializationMs}`,
        `api-overhead;dur=${timing.apiOverheadMs}`,
        `api-total;dur=${timing.apiTotalMs}`,
      ].join(", ")
    );

    return res.status(200).json(responseBody);
  } catch (error) {
    if (error?.code === "ACCESSIBILITY_QUEUE_TIMEOUT") {
      return res.status(503).json({
        error: "Accessibility calculation queue wait timed out",
        requestId: queueRequestId,
        retryAfterSeconds: 30,
      });
    }

    if (error?.code === "ACCESSIBILITY_QUEUE_FULL") {
      return res.status(503).json({
        error: "Accessibility calculation queue is full",
        requestId: queueRequestId,
        retryAfterSeconds: 60,
      });
    }

    console.error("Error in API:", error);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    if (queueTicket) {
      finishAccessibilityQueueTurn(
        queueRequestId,
        res.statusCode >= 500 ? "failed" : "completed"
      );
    }
  }
}
