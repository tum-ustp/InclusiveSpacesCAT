// pages/api/accessibility.js
import { Pool } from "pg"; 

const pool = new Pool({
  connectionString: "postgresql://postgres.tcxrvmwzddsyivnfurdx:incspace123456@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) { 
const { lat, lon, time, speed, n, city } = req.query;
const cityId = (city || "hamburg").toLowerCase();

let waysTable = "hh_ways";
let verticesTable = "hh_ways_vertices_pgr";
if (cityId === "penteli") {
  waysTable = "pt_ways";
  verticesTable = "pt_ways_vertices_pgr";
}

const walkingTime = parseFloat(time) || 15; // minutes
const walkingSpeed = parseFloat(speed) || 5; // km/h
const maxDistance = (walkingSpeed * 1000 * walkingTime) / 60; // units in meters

const nInt = Number.parseInt(n, 10);
const nWeights = Number.isFinite(nInt) && nInt > 0 ? nInt : 1; //number of weights, at least 1 as default

  if (!lat || !lon) {
    return res.status(400).json({ error: "Missing lat/lon" });
  }

  try { 
    const nearestVertexResult = await pool.query(`
      SELECT id
      FROM ${verticesTable}
      ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
      LIMIT 1;
    `, [lon, lat]);

    const startVid = nearestVertexResult.rows[0]?.id;
    if (!startVid) {
      return res.status(404).json({ error: "No nearby vertex found" });
    }

    const noiseVariable = parseFloat(req.query.noise) || 1.0;
    const lightVariable = parseFloat(req.query.light) || 1.0;
    const tactileVariable = parseFloat(req.query.tactile) || 1.0;
    const trafficLightVariable = parseFloat(req.query.trafficLight) || 1.0;
    const treeVariable = parseFloat(req.query.tree) || 1.0;
    const temperatureSummerVariable = parseFloat(req.query.temperatureSummer) || 1.0;
    const temperatureWinterVariable = parseFloat(req.query.temperatureWinter) || 1.0;
    const blueinfVariable = parseFloat(req.query.blueinf) || 1.0;
    const greeninfVariable = parseFloat(req.query.greeninf) || 1.0;
    const stationVariable = parseFloat(req.query.station) || 1.0;
    const wcDisabledVariable = parseFloat(req.query.wcDisabled) || 1.0;
    const narrowRoadsVariable = parseFloat(req.query.narrowRoads) || 1.0;
    const stairVariable = parseFloat(req.query.stair) || 1.0; 
    const obstacleVariable = parseFloat(req.query.obstacle) || 1.0;
    const slopeVariable = parseFloat(req.query.slope) || 1.0;
    const unevenSurfaceVariable = parseFloat(req.query.unevenSurface) || 1.0;
    const poorPavementVariable = parseFloat(req.query.poorPavement) || 1.0;
    const kerbsHighVariable = parseFloat(req.query.kerbsHigh) || 1.0;
    const facilityVariable = parseFloat(req.query.facility) || 1.0;
    const pedestrianFlowVariable = parseFloat(req.query.pedestrianFlow) || 1.0;
 
    const result = await pool.query(`
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
              ), 1e-6) AS cost
          FROM ${waysTable}',
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
        FROM ${waysTable} w
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
            ), 1e-6
          ) AS adjusted_cost
        FROM candidate_roads c
      ),
      final_roads AS (
        SELECT *
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
      )
      SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(
          json_agg(
            json_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(fr.the_geom)::json,
              'properties', json_build_object('gid', fr.gid)
            )
          ),
          '[]'::json
        )
      ) AS geojson
      FROM final_roads fr
    `, [startVid, 
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
        pedestrianFlowVariable]);
      
 
    const geojson = result.rows[0].geojson;

    if (!geojson || !geojson.features || geojson.features.length === 0) {
      return res.status(200).json({
        roads: null,
        message: "No reachable roads found for this setting.",
      });
    }
 
    res.status(200).json({
        roads: result.rows[0].geojson, 
      });

  } catch (error) {
    console.error("Error in API:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
