// pages/api/layerdata.js
// if use Supabase to fetch layer data
import { Pool } from "pg";

let pool;

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

export default async function handler(req, res) {
  const { layer } = req.query;
  if (!layer) return res.status(400).json({ error: "Missing layer name" });

  try {
    const db = getPool();
    const result = await db.query(`
      SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', json_agg(ST_AsGeoJSON(geom)::json)
      ) as geojson
      FROM ${layer}
    `);

    res.status(200).json(result.rows[0].geojson);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
}
