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
    frontierDepthMeters: 260,
    frontierInnerStreetPadding: 3,
  },
  penteli: {
    waysTable: "pt_ways",
    verticesTable: "pt_ways_vertices_pgr",
    simplifyTolerance: 0.00006,
    frontierDepthMeters: 420,
    frontierInnerStreetPadding: 3,
  },
};

const parseValue = (value, fallback = 1.0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseNonNegativeValue = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const parseNonNegativeInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const toFixedMs = (value) => Number(value.toFixed(2));

export default async function handler(req, res) {
  const requestStart = performance.now();
  const { lat, lon, time, speed, city, geometry } = req.query;
  const cityId = (city || "hamburg").toLowerCase();
  const cityConfig = CITY_CONFIG[cityId] || CITY_CONFIG.hamburg;
  const geometryMode = geometry === "simplified" ? "simplified" : "full";
  const frontierDepthMeters = parseNonNegativeValue(
    req.query.frontierDepth,
    cityConfig.frontierDepthMeters
  );
  const frontierInnerStreetPadding = parseNonNegativeInteger(
    req.query.frontierInnerStreetPadding,
    cityConfig.frontierInnerStreetPadding
  );

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
            c.cost / GREATEST(
              LEAST(
                CASE WHEN c.noise_weight = 1 THEN $3::float ELSE 1.0 END,
                CASE WHEN c.light_weight = 0 THEN $4::float ELSE 1.0 END,
                CASE WHEN c.trafficlight_weight = 1 THEN $5::float ELSE 1.0 END,
                CASE WHEN c.tactile_weight = 0 THEN $6::float ELSE 1.0 END,
                CASE WHEN c.tree_weight = 0 THEN $7::float ELSE 1.0 END,
                CASE WHEN c.temp_weight_s = 1 THEN $8::float ELSE 1.0 END,
                CASE WHEN c.temp_weight_w = 1 THEN $9::float ELSE 1.0 END,
                CASE WHEN c.blue_weight = 0 THEN $10::float ELSE 1.0 END,
                CASE WHEN c.green_weight = 0 THEN $11::float ELSE 1.0 END,
                CASE WHEN c.station_weight = 0 THEN $12::float ELSE 1.0 END,
                CASE WHEN c.wc_d_weight = 0 THEN $13::float ELSE 1.0 END,
                CASE WHEN c.path_width_weight = 1 THEN $14::float ELSE 1.0 END,
                CASE WHEN c.stair_weight = 1 THEN $15::float ELSE 1.0 END,
                CASE WHEN c.obstacle_weight = 1 THEN $16::float ELSE 1.0 END,
                CASE WHEN c.slope_weight = 1 THEN $17::float ELSE 1.0 END,
                CASE WHEN c.uneven_surfaces_weight = 1 THEN $18::float ELSE 1.0 END,
                CASE WHEN c.poor_pavement_weight = 1 THEN $19::float ELSE 1.0 END,
                CASE WHEN c.kerbs_h_weight = 1 THEN $20::float ELSE 1.0 END,
                CASE WHEN c.facilities_weight = 0 THEN $21::float ELSE 1.0 END,
                CASE WHEN c.pedestrian_flow_weight = 1 THEN $22::float ELSE 1.0 END
              ),
              1e-6
            ) AS adjusted_cost
          FROM candidate_roads c
        ),
        final_roads AS (
          SELECT
            r.gid,
            r.source,
            r.target,
            r.the_geom,
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
        frontier_stats AS (
          SELECT
            COALESCE(MAX(agg_cost), 0) AS max_agg_cost
          FROM final_roads
        ),
        frontier_core AS (
          SELECT
            fr.gid,
            fr.source,
            fr.target,
            fr.the_geom,
            fr.agg_cost
          FROM final_roads fr
          CROSS JOIN frontier_stats fs
          WHERE
            $25::float <= 0
            OR fr.agg_cost >= GREATEST(0, fs.max_agg_cost - $25::float)
        ),
        road_nodes AS (
          SELECT gid, source AS node, agg_cost
          FROM final_roads

          UNION ALL

          SELECT gid, target AS node, agg_cost
          FROM final_roads
        ),
        frontier_nodes AS (
          SELECT gid, source AS node, agg_cost
          FROM frontier_core

          UNION ALL

          SELECT gid, target AS node, agg_cost
          FROM frontier_core
        ),
        inner_padding_1 AS (
          SELECT DISTINCT
            fr.gid,
            fr.source,
            fr.target,
            fr.the_geom,
            fr.agg_cost
          FROM frontier_nodes fn
          INNER JOIN road_nodes rn
            ON rn.node = fn.node
            AND rn.gid <> fn.gid
            AND rn.agg_cost <= fn.agg_cost
          INNER JOIN final_roads fr ON fr.gid = rn.gid
          WHERE $26::int >= 1
        ),
        inner_padding_1_nodes AS (
          SELECT gid, source AS node, agg_cost
          FROM inner_padding_1

          UNION ALL

          SELECT gid, target AS node, agg_cost
          FROM inner_padding_1
        ),
        inner_padding_2 AS (
          SELECT DISTINCT
            fr.gid,
            fr.source,
            fr.target,
            fr.the_geom,
            fr.agg_cost
          FROM inner_padding_1_nodes pn
          INNER JOIN road_nodes rn
            ON rn.node = pn.node
            AND rn.gid <> pn.gid
            AND rn.agg_cost <= pn.agg_cost
          INNER JOIN final_roads fr ON fr.gid = rn.gid
          WHERE $26::int >= 2
        ),
        inner_padding_2_nodes AS (
          SELECT gid, source AS node, agg_cost
          FROM inner_padding_2

          UNION ALL

          SELECT gid, target AS node, agg_cost
          FROM inner_padding_2
        ),
        inner_padding_3 AS (
          SELECT DISTINCT
            fr.gid,
            fr.source,
            fr.target,
            fr.the_geom,
            fr.agg_cost
          FROM inner_padding_2_nodes pn
          INNER JOIN road_nodes rn
            ON rn.node = pn.node
            AND rn.gid <> pn.gid
            AND rn.agg_cost <= pn.agg_cost
          INNER JOIN final_roads fr ON fr.gid = rn.gid
          WHERE $26::int >= 3
        ),
        selected_roads AS (
          SELECT DISTINCT ON (gid)
            gid,
            the_geom,
            agg_cost
          FROM (
            SELECT gid, the_geom, agg_cost FROM frontier_core

            UNION ALL

            SELECT gid, the_geom, agg_cost FROM inner_padding_1

            UNION ALL

            SELECT gid, the_geom, agg_cost FROM inner_padding_2

            UNION ALL

            SELECT gid, the_geom, agg_cost FROM inner_padding_3
          ) padded_frontier
          ORDER BY gid, agg_cost DESC
        ),
        raw_payload_stats AS (
          SELECT
            COUNT(*)::int AS feature_count,
            COALESCE(SUM(ST_NPoints(the_geom)), 0)::bigint AS total_points
          FROM selected_roads
        ),
        collected_network AS (
          SELECT
            ST_Multi(
              ST_CollectionExtract(
                ST_LineMerge(ST_UnaryUnion(ST_Collect(the_geom))),
                2
              )
            ) AS geom
          FROM selected_roads
        ),
        geometry_for_output AS (
          SELECT
            1::int AS gid,
            ST_Multi(
              CASE
                WHEN $23::text = 'simplified'
                  THEN ST_SimplifyPreserveTopology(geom, $24::float)
                ELSE geom
              END
            ) AS geom
          FROM collected_network
          WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
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
        frontierDepthMeters,
        frontierInnerStreetPadding,
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
      frontierDepthMeters,
      frontierInnerStreetPadding,
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
