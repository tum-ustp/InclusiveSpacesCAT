// Hamburg POI config used by facilities layer, legend, and amenities count.
// Penteli stays unchanged and continues to use existing inline config.
export const HAMBURG_POI_CONFIG = [
  { key: "poi_hh_gastronomy", color: "#f4a6c3", label: "Gastronomy" },
  { key: "poi_hh_health", color: "#e37222", label: "Health & healthcare" },
  { key: "poi_hh_kita_schule", color: "#846bfa", label: "Educational facilities" },
  { key: "poi_hh_uni_fh", color: "#846bfa", label: "Educational facilities" },
  { key: "poi_hh_park_spiel", color: "#0065bd", label: "Parks & playgrounds" },
  { key: "poi_hh_supermarket", color: "#fc476a", label: "Supermarkets" }
];

export const HAMBURG_FACILITY_POI_LAYERS = HAMBURG_POI_CONFIG.map((item) => item.key);

export const HAMBURG_FACILITY_POI_COLORS = Object.fromEntries(
  HAMBURG_POI_CONFIG.map((item) => [item.key, item.color])
);
