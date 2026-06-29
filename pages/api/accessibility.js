import { Pool } from "pg";
import { performance } from "node:perf_hooks";

const pool = new Pool({
  connectionString: "postgresql://postgres.tcxrvmwzddsyivnfurdx:incspace123456@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false },
});

const CITY_CONFIG = {
  hamburg: {
    waysTable: "hh_ways",
    verticesTable: "hh_ways_vertices_pgr",
    simplifyTolerance: 0.00005,
  },
  penteli: {
    waysTable: "pt_ways",
    verticesTable: "pt_ways_vertices_pgr",
    simplifyTolerance: 0.00006,
  },
};

const parseValue = (value, fallback = 1.0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toFixedMs = (value) => Number(value.toFixed(2));

export default async function handler(req, res) {
  const requestStart = performance.now();
  const { lat, lon, time, speed, city, geometry } = req.query;
  const cityId = (city || "hamburg").toLowerCase();
  const cityConfig = CITY_CONFIG[cityId] || CITY_CONFIG.hamburg;
  const geometryMode = geometry === "simplified" ? "simplified" : "full";

  if (!lat || !lon) {
    return res.status(400).json({ error: "Missing lat/lon" });
  }

  const walkingTime = parseValue(time, 15);
  const walkingSpeed = parseValue(speed, 5);
  const maxDistance = (walkingSpeed * 1000 * walkingTime) / 60;

  try {
    const nearestVertexStart = performance.now();
    const nearestVertexResult = await pool.query(
      `
        SELECT id
        FROM ${cityConfig.verticesTable}
        ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
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
    const result = await pool.query(
      `
        WITH dd AS (
          SELECT *
          FROM pgr_drivingDistance(
            'SELECT gid AS id, source, target,
              cost / GREATEST(
                LEAST(
                  CASE WHEN noise_weight = 1 THEN ' || $3 || ' ELSE 1 END,
                  CASE WHEN light_weight = 0 THEN ' || $4 || ' ELSE 1 END,
                  CASE WHEN trafficlight_weight = 1 THEN ' || $5 || ' ELSE 1 END,
                  CASE WHEN tactile_weight = 0 THEN ' || $6 || ' ELSE 1 END,
                  CASE WHEN tree_weight = 0 THEN ' || $7 || ' ELSE 1 END,
                  CASE WHEN temp_weight_s = 1 THEN ' || $8 || ' ELSE 1 END,
                  CASE WHEN temp_weight_w = 1 THEN ' || $9 || ' ELSE 1 END,
                  CASE WHEN blue_weight = 0 THEN ' || $10 || ' ELSE 1 END,
                  CASE WHEN green_weight = 0 THEN ' || $11 || ' ELSE 1 END,
                  CASE WHEN station_weight = 0 THEN ' || $12 || ' ELSE 1 END,
                  CASE WHEN wc_d_weight = 0 THEN ' || $13 || ' ELSE 1 END,
                  CASE WHEN path_width_weight = 1 THEN ' || $14 || ' ELSE 1 END,
                  CASE WHEN stair_weight = 1 THEN ' || $15 || ' ELSE 1 END,
                  CASE WHEN obstacle_weight = 1 THEN ' || $16 || ' ELSE 1 END,
                  CASE WHEN slope_weight = 1 THEN ' || $17 || ' ELSE 1 END,
                  CASE WHEN uneven_surfaces_weight = 1 THEN ' || $18 || ' ELSE 1 END,
                  CASE WHEN poor_pavement_weight = 1 THEN ' || $19 || ' ELSE 1 END,
                  CASE WHEN kerbs_h_weight = 1 THEN ' || $20 || ' ELSE 1 END,
                  CASE WHEN facilities_weight = 0 THEN ' || $21 || ' ELSE 1 END,
                  CASE WHEN pedestrian_flow_weight = 1 THEN ' || $22 || ' ELSE 1 END
                ),
                1e-6
              ) AS cost
            FROM ${cityConfig.waysTable}',
            $1::integer,
            $2::float,
            false::boolean
          )
        ),
        final_roads AS (
          SELECT
            w.gid,
            w.the_geom
          FROM ${cityConfig.waysTable} w
          WHERE w.gid IN (
            SELECT edge
            FROM dd
            WHERE edge IS NOT NULL AND edge <> -1
          )
        ),
        raw_payload_stats AS (
          SELECT
            COUNT(*)::int AS feature_count,
            COALESCE(SUM(ST_NPoints(the_geom)), 0)::bigint AS total_points
          FROM final_roads
        ),
        collected_network AS (
          SELECT ST_LineMerge(ST_UnaryUnion(ST_Collect(the_geom))) AS geom
          FROM final_roads
        ),
        dumped_output AS (
          SELECT
            (ST_Dump(
              ST_Multi(
                CASE
                  WHEN $23::text = 'simplified'
                    THEN ST_SimplifyPreserveTopology(geom, $24::float)
                  ELSE geom
                END
              )
            )).geom AS geom
          FROM collected_network
          WHERE geom IS NOT NULL
        ),
        geometry_for_output AS (
          SELECT
            ROW_NUMBER() OVER (ORDER BY ST_XMin(geom), ST_YMin(geom))::int AS gid,
            geom
          FROM dumped_output
        ),
        output_payload_stats AS (
          SELECT
            COUNT(*)::int AS feature_count,
            COALESCE(SUM(ST_NPoints(geom)), 0)::bigint AS total_points
          FROM geometry_for_output
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
          ) AS geojson,
          raw_payload_stats.feature_count,
          raw_payload_stats.total_points AS raw_total_points,
          output_payload_stats.total_points AS output_total_points
        FROM raw_payload_stats
        CROSS JOIN output_payload_stats
        LEFT JOIN geometry_for_output go ON TRUE
        GROUP BY
          raw_payload_stats.feature_count,
          raw_payload_stats.total_points,
          output_payload_stats.total_points;
      `,
      [
        startVid,
        maxDistance,
        noiseVariable,
        lightVariable,
        trafficLightVariable,
        tactileVariable,
        treeVariable,
        temperatureSummerVariable,
        temperatureWinterVariable,
        blueinfVariable,
        greeninfVariable,
        stationVariable,
        wcDisabledVariable,
        narrowRoadsVariable,
        stairVariable,
        obstacleVariable,
        slopeVariable,
        unevenSurfaceVariable,
        poorPavementVariable,
        kerbsHighVariable,
        facilityVariable,
        pedestrianFlowVariable,
        geometryMode,
        cityConfig.simplifyTolerance,
      ]
    );
    const routingQueryMs = performance.now() - routingQueryStart;
    const apiTotalMs = performance.now() - requestStart;
    const apiOverheadMs = Math.max(
      0,
      apiTotalMs - nearestVertexMs - routingQueryMs
    );

    const row = result.rows[0] || {};
    const geojson = row.geojson;
    const timing = {
      nearestVertexMs: toFixedMs(nearestVertexMs),
      routingQueryMs: toFixedMs(routingQueryMs),
      pgrDrivingDistanceMs: toFixedMs(routingQueryMs),
      apiOverheadMs: toFixedMs(apiOverheadMs),
      apiTotalMs: toFixedMs(apiTotalMs),
      geometryMode,
      featureCount: row.feature_count || 0,
      rawCoordinateCount: Number(row.raw_total_points || 0),
      outputCoordinateCount: Number(row.output_total_points || 0),
      responseBytes: 0,
    };

    const responseBody = {
      roads:
        geojson && Array.isArray(geojson.features) && geojson.features.length > 0
          ? geojson
          : null,
      message:
        geojson && Array.isArray(geojson.features) && geojson.features.length > 0
          ? undefined
          : "No reachable roads found for this setting.",
      timing,
    };

    timing.responseBytes = Buffer.byteLength(
      JSON.stringify(responseBody),
      "utf8"
    );

    res.setHeader(
      "Server-Timing",
      [
        `nearest-vertex;dur=${timing.nearestVertexMs}`,
        `routing-query;dur=${timing.routingQueryMs}`,
        `api-overhead;dur=${timing.apiOverheadMs}`,
        `api-total;dur=${timing.apiTotalMs}`,
      ].join(", ")
    );

    return res.status(200).json(responseBody);
  } catch (error) {
    console.error("Error in API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
