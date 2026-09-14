// Hamburg POI config used by facilities layer, legend, and amenities count.
// Penteli stays unchanged and continues to use existing inline config.
export const FACILITY_POI_COLORS_BY_CATEGORY = {
  gastronomy: "#f4a6c3",
  health: "#e37222",
  education: "#846bfa",
  park: "#0065bd",
  supermarket: "#fc476a",
};

export const HAMBURG_POI_CONFIG = [
  { key: "poi_hh_gastronomy", category: "gastronomy", label: "Gastronomy" },
  { key: "poi_hh_health", category: "health", label: "Health & healthcare" },
  { key: "poi_hh_kita_schule", category: "education", label: "Educational facilities" },
  { key: "poi_hh_uni_fh", category: "education", label: "Educational facilities" },
  { key: "poi_hh_park_spiel", category: "park", label: "Parks & playgrounds" },
  { key: "poi_hh_supermarket", category: "supermarket", label: "Supermarkets" }
];

export const MUNICH_POI_CONFIG = [
  { key: "poi_muc_gastronomy", category: "gastronomy", label: "Gastronomy" },
  { key: "poi_muc_health", category: "health", label: "Health & healthcare" },
  { key: "poi_muc_kita_schule", category: "education", label: "Educational facilities" },
  { key: "poi_muc_uni_fh", category: "education", label: "Educational facilities" },
  { key: "poi_muc_park_spiel", category: "park", label: "Parks & playgrounds" },
  { key: "poi_muc_supermarket", category: "supermarket", label: "Supermarkets" }
];

export const FACILITY_POI_LAYERS_BY_CITY = {
  hamburg: HAMBURG_POI_CONFIG.map((item) => item.key),
  munich: MUNICH_POI_CONFIG.map((item) => item.key),
};

export const buildFacilityPoiColors = (items) => Object.fromEntries(
  items.map((item) => [
    item.key,
    FACILITY_POI_COLORS_BY_CATEGORY[item.category],
  ])
);

export const FACILITY_POI_COLORS_BY_LAYER = buildFacilityPoiColors([
  ...HAMBURG_POI_CONFIG,
  ...MUNICH_POI_CONFIG,
]);
