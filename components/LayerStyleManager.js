// /layers/layerManager.js
let L;
if (typeof window !== "undefined") {
  L = require("leaflet");
}
// import { useMap } from "react-leaflet";
let useMap;
if (typeof window !== "undefined") {
  useMap = require("react-leaflet").useMap;
}
import { useEffect } from "react";
import { HAMBURG_FACILITY_POI_COLORS } from "./poiConfig";

// layer grounp for tactile guidance
export const layerGroupMap = {
  tactile_guidance: ["tactile_points", "tactile_lines", "tactile_polygons"],
  munich_lighting: [
    "muc_osm_lit_highways_visual",
    "muc_street_lamps_visual"
  ]
};

// Build a fast lookup for layer type from availableLayers config [{key,type}, ...]
export const buildLayerTypeMap = (availableLayers = []) => {
  return new Map((availableLayers || []).map((l) => [l.key, l.type]));
};

// Single source of truth: WMS if layerTypeMap says so
export const isWmsLayer = (layerKey, layerTypeMap) => {
  return layerTypeMap?.get(layerKey) === "wms";
};

// use circleMarker render point layers
export const useCircleMarker = (layer) =>
  ["tactile_points"].includes(layer);
 
export function getStyle(layer, feature) { 

  switch (layer) { 
    case "streetlight": // hamburg
    case "muc_street_lamps_visual":
      return {
        radius: 5,
        fillColor: "#ffd166",
        fillOpacity: 0.8,
        stroke: false
      }; 
    case "muc_osm_lit_highways_visual": {
      const lighting = String(
        feature?.properties?.lighting ?? feature?.properties?.lit ?? ""
      ).toLowerCase();
      const isLit = lighting === "lit" || lighting === "yes";

      return {
        color: isLit ? "#ffac29" : "#4b5563",
        weight: 2.5,
        opacity: isLit ? 0.9 : 0.75,
        dashArray: isLit ? undefined : "5,5"
      };
    }
    case "tactile_points":
      return {
        radius: 5,
        fillColor: "#be609a",
        fillOpacity: 0.8,
        stroke: false     
      };

    case "tactile_lines":
      return {
        color: "#be609a", 
        weight: 2,
        opacity: 0.9
      };

    case "tactile_polygons":
      return {
        color: "#be609a",      
        fillColor: "#be609a",   
        fillOpacity: 0.6,
        weight: 1,
        opacity: 0.6
      };
    
    case "wc_disabled":
      return {
        radius: 5,
        fillColor: "#e4a28b",
        fillOpacity: 0.8,
        stroke: false     
      };

    case "sidewalk_narrow":
      return {
        color: "#992842", 
        weight: 2,
        opacity: 0.9
      };
    
    case "stair":
      return {
        color: "#91744a", 
        weight: 2,
        opacity: 0.9
      };
    
    case "obstacle":
      return {
        radius: 5,
        fillColor: "#d65a90",
        fillOpacity: 0.8,
        stroke: false     
      };

    case "slope":
      return {
        color: "#6c8be0", 
        weight: 2,
        opacity: 0.9
      };

    case "uneven_surfaces":
      return {
        color: "#b30000", 
        weight: 2,
        opacity: 0.9
      };

    case "poor_pavement":
      return {
        color: "#a5ab59", 
        weight: 2,
        opacity: 0.9
      };

    case "kerbs_high":
      return {
        radius: 5,
        fillColor: "#d65a90",
        fillOpacity: 0.8,
        stroke: false     
      };

    case "temp_summer":{
      const breaks = [ 
        { max: 11,  color: "#ffaaaa" },
        { max: 20,  color: "#ff5555" },
        { max: 100,  color: "#ff0000" },
      ];

      const val = parseFloat(feature?.properties?.comfort);
      const match = breaks.find(b => val < b.max) || breaks[breaks.length - 1];

      return {
        color: "#000",
        weight: 0.1,
        fillColor: match.color,
        fillOpacity: 0.6
      };
    }

    case "temp_winter": {
      const breaks = [
        { max: -7.5,  color: "#08306b" },
        { max: -4.5,  color: "#3e8ec4" },
        { max: 0,  color: "#afd1e7" }, 
      ];

      const val = parseFloat(feature?.properties?.comfort);
      const match = breaks.find(b => val < b.max) || breaks[breaks.length - 1];

      return {
        color: "#000",
        weight: 0.1,
        fillColor: match.color,
        fillOpacity: 0.6
      };
    }

    // penteli-----------------
    case "trafic_light":
      return {
        radius: 5,
        fillColor: "#F09E45", 
        fillOpacity: 0.8,
        stroke: false
      };
    case "slope_penteli": {
      const breaks = [
        { max: 5, color: "#fee08b" }, 
        { max: 12, color: "#fc8d59" },
        { max: 20, color: "#d73027" } 
      ];

      const val = parseFloat(feature?.properties?.VALUE);

      const match = breaks.find(b => val < b.max) || breaks[breaks.length - 1];

      return {
        color: "#999",
        weight: 0.2,
        fillColor: match.color,
        fillOpacity: 0.6
      };
    }
    case "green_infrastructure":
      return {
        color: "#6dbf52",
        weight: 2,
        fillColor: "#93e086",
        fillOpacity: 0.5
      };
    case "transport_station":
      return {
        radius: 5,
        fillColor: "#5d69b3",
        fillOpacity: 0.8,
        stroke: false
      };
    case "facilities":
    case "facility_hh":
      return {
        radius: 5,
        fillColor: "#E377C2",
        fillOpacity: 0.8,
        stroke: false
      };
    case "poi_hh_gastronomy":
    case "poi_hh_haltstelle":
    case "poi_hh_health":
    case "poi_hh_kita_schule":
    case "poi_hh_park_spiel":
    case "poi_hh_supermarket":
    case "poi_hh_uni_fh":
      return {
        radius: 5,
        fillColor: HAMBURG_FACILITY_POI_COLORS[layer] || "#E377C2",
        fillOpacity: 0.8,
        stroke: false
      };
    case "pedestrian_flow":
      return {
        color: "#fd7f0e",
        weight: 2,
        opacity: 0.7
      };

      return {
        color: "#000", 
        weight: 0.1,
        fillColor: fillColorWinter,
        fillOpacity: 0.5
      };

    default:
      return {
        color: "#555",
        weight: 1,
        fillOpacity: 0.6
      };
  }
}

// import WMS layers from Geoportal Hamburg
export function NoiseWMSLayer() {
  const map = useMap();
  useEffect(() => {
    const layer = L.tileLayer.wms("https://geodienste.hamburg.de/HH_WMS_Strassenverkehr", {
      layers: "strassenverkehr_tag_abend_nacht_2022",
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      attribution: "© Geoportal Hamburg"
    });
    layer.addTo(map);
    return () => map.removeLayer(layer);
  }, [map]);
  return null;
}

export function TreeWMSLayer() {
  const map = useMap();
  useEffect(() => {
    const layer = L.tileLayer.wms("https://geodienste.hamburg.de/HH_WMS_Pflanzstandorte", {
      layers: "baumpflanzung",
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      attribution: "© Geoportal Hamburg"
    });
    layer.addTo(map);
    return () => map.removeLayer(layer);
  }, [map]);
  return null;
}

export function TraficLightWMSLayer() {
  const map = useMap();
  useEffect(() => {
    const layer = L.tileLayer.wms("https://geodienste.hamburg.de/HH_WMS_Lichtsignalanlagen", {
      layers: "lichtsignalanlagen",
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      attribution: "© Geoportal Hamburg"
    });
    layer.addTo(map);
    return () => map.removeLayer(layer);
  }, [map]);
  return null;
}

export function BlueInfWMSLayer() {
  const map = useMap();
  useEffect(() => {
    const layer = L.tileLayer.wms("https://geodienste.hamburg.de/HH_WMS_Geotourismus", {
      layers: "wasseruwasserbau",
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      attribution: "© Geoportal Hamburg"
    });
    layer.addTo(map);
    return () => map.removeLayer(layer);
  }, [map]);
  return null;
}

export function GreenInfWMSLayer() {
  const map = useMap();
  useEffect(() => {
    const layer = L.tileLayer.wms("https://geodienste.hamburg.de/HH_WMS_Gruenplan", {
      layers: "gruenplan",
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      attribution: "© Geoportal Hamburg"
    });
    layer.addTo(map);
    return () => map.removeLayer(layer);
  }, [map]);
  return null;
}

export function StationWMSLayer() {
  const map = useMap();
  useEffect(() => {
    const layer = L.tileLayer.wms("https://geodienste.hamburg.de/MRH_WMS_Erreichbarkeitsanalysen_Ziele_Einrichtungen", {
      layers: "mrh_haltestellen",
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      attribution: "© Geoportal Hamburg"
    });
    layer.addTo(map);
    return () => map.removeLayer(layer);
  }, [map]);
  return null;
} 

export function FacilityWMSLayer() {
  const map = useMap();
  useEffect(() => {
    const layer = L.tileLayer.wms("https://geodienste.hamburg.de/wms_bildung_kultur_eimsbuettel", {
      layers: "bildung_kultur_eimsbuettel",
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      attribution: "© Geoportal Hamburg"
    });
    layer.addTo(map);
    return () => map.removeLayer(layer);
  }, [map]);
  return null;
} 

export function PedestrianFlowWMSLayer() {
  const map = useMap();
  useEffect(() => {
    const layer = L.tileLayer.wms("https://geodienste.hamburg.de/wms_bedeutungsraeume_fussverkehr", {
      layers: "bedeutungsraeume_heatmap",
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      attribution: "© Geoportal Hamburg"
    });
    layer.addTo(map);
    return () => map.removeLayer(layer);
  }, [map]);
  return null;
} 

export const wmsLayerComponents = {
  noise_wms: NoiseWMSLayer,
  tree_wms: TreeWMSLayer,
  trafic_light_wms: TraficLightWMSLayer,
  blue_infrastructure_wms: BlueInfWMSLayer,
  green_infrastructure_wms: GreenInfWMSLayer,
  transport_station_wms: StationWMSLayer,
  pedestrian_flow_wms: PedestrianFlowWMSLayer
};

