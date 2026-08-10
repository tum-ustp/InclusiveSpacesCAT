// define which city has which discomfort features and map layers
export const cityLayerConfig = {
  hamburg: {
    discomfortFeatures: [
      "noise", "light", "tree", "trafficLight", "tactile_pavement",
      "temperatureSummer", "temperatureWinter", "greeninf", "blueinf",
      "station", "wcDisabled", "narrowRoads", "ramp", "stair",
      "obstacle", "slope", "unevenSurface", "poorPavement", "kerbsHigh",
      "facility", "pedestrianFlow"
    ],
    mapLayers: [
      { key: "noise_wms", type: "wms" },
      { key: "temp_summer", type: "geojson" },
      { key: "temp_winter", type: "geojson" },
      { key: "streetlight", type: "geojson" },
      { key: "trafic_light_wms", type: "wms" },
      { key: "tactile_guidance", type: "geojson" },
      { key: "tree_wms", type: "wms" },
      { key: "green_infrastructure_wms", type: "wms" },
      { key: "blue_infrastructure_wms", type: "wms" },
      { key: "transport_station_wms", type: "wms" },
      { key: "wc_disabled", type: "geojson" },
      { key: "sidewalk_narrow", type: "geojson" },
      { key: "stair", type: "geojson" },
      { key: "obstacle", type: "geojson" },
      { key: "slope", type: "geojson" },
      { key: "uneven_surfaces", type: "geojson" },
      { key: "poor_pavement", type: "geojson" },
      { key: "kerbs_high", type: "geojson" },
      { key: "facility_hh", type: "geojson" },
      { key: "pedestrian_flow_wms", type: "wms" }
    ]
  },
  penteli: {
    discomfortFeatures: [
      "trafficLight", "greeninf", "temperatureSummer", "temperatureWinter", "station", "stair", "slope", "facility", "pedestrianFlow"
    ],
    mapLayers: [
      { key: "trafic_light", type: "geojson" },
      { key: "green_infrastructure", type: "geojson" },
      { key: "transport_station", type: "geojson" },
      { key: "stair", type: "geojson" },
      { key: "slope_penteli", type: "geojson" },
      { key: "facilities", type: "geojson" },
      { key: "pedestrian_flow", type: "geojson" },
      { key: "temp_summer", type: "geojson" },
      { key: "temp_winter", type: "geojson" }
    ]
  },
  munich: {
    discomfortFeatures: [
      "noise", "light", "tree", "trafficLight", "tactile_pavement",
      "temperatureSummer", "temperatureWinter", "greeninf", "blueinf",
      "station", "wcDisabled", "narrowRoads", "stair",
      "obstacle", "slope", "unevenSurface", "poorPavement", "kerbsHigh",
      "facility", "pedestrianFlow"
    ],
    mapLayers: [
      { key: "munich_lighting", type: "geojson" }
    ]
  }
  // other cities...
};
