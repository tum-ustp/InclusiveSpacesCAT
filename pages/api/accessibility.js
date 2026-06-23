// pages/api/accessibility.js
import { Pool } from "pg";
import { performance } from "node:perf_hooks";

const pool = new Pool({
  connectionString: "postgresql://postgres.tcxrvmwzddsyivnfurdx:incspace123456@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) { 
const requestStart = performance.now();
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
    const nearestVertexStart = performance.now();
    const nearestVertexResult = await pool.query(`
      SELECT id
      FROM ${verticesTable}
      ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
      LIMIT 1;
    `, [lon, lat]);
    const nearestVertexMs = performance.now() - nearestVertexStart;

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
 
    const routingQueryStart = performance.now();
    const result = await pool.query(`
      SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', json_agg(
          json_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(w.the_geom)::json,
            'properties', json_build_object('gid', w.gid)
          )
        )
      ) AS geojson
      FROM ${waysTable} w
      WHERE gid IN (
        SELECT edge
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
      )
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
    const routingQueryMs = performance.now() - routingQueryStart;
    const apiTotalMs = performance.now() - requestStart;
      
 
    const geojson = result.rows[0].geojson;
    const timing = {
      nearestVertexMs: Number(nearestVertexMs.toFixed(2)),
      pgrDrivingDistanceMs: Number(routingQueryMs.toFixed(2)),
      apiTotalMs: Number(apiTotalMs.toFixed(2)),
    };

    res.setHeader(
      "Server-Timing",
      [
        `nearest-vertex;dur=${timing.nearestVertexMs}`,
        `pgr-driving-distance;dur=${timing.pgrDrivingDistanceMs}`,
        `api-total;dur=${timing.apiTotalMs}`
      ].join(", ")
    );

    if (!geojson || !geojson.features || geojson.features.length === 0) {
      return res.status(200).json({
        roads: null,
        message: "No reachable roads found for this setting.",
        timing,
      });
    }
 
    res.status(200).json({
        roads: result.rows[0].geojson, 
        timing,
      });

  } catch (error) {
    console.error("Error in API:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
