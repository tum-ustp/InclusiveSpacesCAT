// Hamburg POI config used by facilities layer, legend, and amenities count.
// Penteli stays unchanged and continues to use existing inline config.
export const HAMBURG_POI_CONFIG = [
  { key: "poi_hh_gastronomy", color: "#D8A3C7", label: "Gastronomy" },
  { key: "poi_hh_haltstelle", color: "#4F5F8F", label: "Public transport" },
  { key: "poi_hh_health", color: "#E6D69C", label: "Health & healthcare" },
  { key: "poi_hh_kita_schule", color: "#C9B8E4", label: "Educational facilities" },
  { key: "poi_hh_uni_fh", color: "#C9B8E4", label: "Educational facilities" },
  { key: "poi_hh_park_spiel", color: "#5F9F70", label: "Parks & playgrounds" },
  { key: "poi_hh_supermarket", color: "#E6BF96", label: "Supermarkets" }
];

export const HAMBURG_FACILITY_POI_LAYERS = HAMBURG_POI_CONFIG.map((item) => item.key);

export const HAMBURG_FACILITY_POI_COLORS = Object.fromEntries(
  HAMBURG_POI_CONFIG.map((item) => [item.key, item.color])
);

