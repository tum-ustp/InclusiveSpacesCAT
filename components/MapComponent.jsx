import { useState, useEffect, useRef, useMemo } from "react"; 
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css"; 
import * as turf from "@turf/turf";
import proj4 from "proj4"; 
import Legend from "./Legend";
import sty from './MapComponent.module.css'; 
import {getStyle, useCircleMarker,isWmsLayer, buildLayerTypeMap, layerGroupMap, wmsLayerComponents} from "./LayerStyleManager"; 
import { HAMBURG_FACILITY_POI_LAYERS } from "./poiConfig";
import { useTranslation } from "next-i18next";

// Dynamic import for react-leaflet
const MapLib = dynamic(
  () => import("react-leaflet"),
  { ssr: false }
); 

proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");
proj4.defs("EPSG:25832", "+proj=utm +zone=32 +ellps=WGS84 +datum=WGS84 +units=m +no_defs");

const EXCLUDED_HAMBURG_FACILITY_POI = "poi_hh_haltstelle";

const markPerformance = (name) => {
  if (typeof performance === "undefined" || !performance.mark) return;
  performance.mark(name);
};

const measurePerformance = (name, startMark, endMark) => {
  if (typeof performance === "undefined" || !performance.measure) return 0;
  performance.measure(name, startMark, endMark);
  const latestEntry = performance.getEntriesByName(name).at(-1);
  return Number((latestEntry?.duration || 0).toFixed(2));
};

const countCoordinates = (geojson) => {
  const countGeometryCoordinates = (geometry) => {
    if (!geometry?.coordinates) return 0;

    const walk = (coords) => {
      if (!Array.isArray(coords)) return 0;
      if (typeof coords[0] === "number") return 1;
      return coords.reduce((sum, part) => sum + walk(part), 0);
    };

    return walk(geometry.coordinates);
  };

  if (Array.isArray(geojson)) {
    return geojson.reduce(
      (sum, feature) => sum + countGeometryCoordinates(feature?.geometry),
      0
    );
  }

  if (geojson?.type === "FeatureCollection") {
    return geojson.features.reduce(
      (sum, feature) => sum + countGeometryCoordinates(feature?.geometry),
      0
    );
  }

  if (geojson?.type === "Feature") {
    return countGeometryCoordinates(geojson.geometry);
  }

  return countGeometryCoordinates(geojson);
};
 
const MapComponent = ({ 
  cityCenter = [53.5503, 9.9920],
  selectedLayers, 
  availableLayers,
  enabledVariables,
  selectingStart, 
  setSelectingStart, 
  walkingTime, 
  walkingSpeed, 
  startPoints, 
  setStartPoints, 
  computeAccessibility,
  setComputeAccessibility,
  resetTrigger,
  onResetHandled,
  clearTrigger,
  onClearHandled,
  layerValues,
  onFocusArea,
  highlightedIndex,
  setHighlightedIndex,
  isSearchZoom, 
  setIsSearchZoom,  
}) => {
  const [MapModule, setMapModule] = useState(null);
  const [customMarkerIcon, setCustomMarkerIcon] = useState(null);
  const [reachableHullData, setReachableHullData] = useState([]); 
  const [geoJsonData, setGeoJsonData] = useState({}); 
  const [isCalculating, setIsCalculating] = useState(false); // function attachment calculation works? 
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 }); 
  const [resultMetadata, setResultMetadata] = useState([]); // store metadata for each result/ user setting each time
  const [defaultResultCache, setDefaultResultCache] = useState({}); // key: `${lat},${lon}`, value: {roads, hull, area}
  const [defaultGroupIndex, setDefaultGroupIndex] = useState(1);  // default group index for the first result
  const [groupMapping, setGroupMapping] = useState({}); // mapping of group index to default results,index for weighted results
  const [cityBoundaries, setCityBoundaries] = useState({});

  const { t } = useTranslation("common");

  const getSelectedCity = () =>
    (typeof window !== "undefined" &&
      (localStorage.getItem("selectedCity") || "hamburg")) ||
    "hamburg";
  const [selectedCity, setSelectedCity] = useState(getSelectedCity);

  const mapRegionLabel = t("aria_map_region");

  const layerTypeMap = useMemo(
    () => buildLayerTypeMap(availableLayers),
    [availableLayers]
  );
  const availableLayerKeys = useMemo(
    () => new Set((availableLayers || []).map((l) => l.key)),
    [availableLayers]
  );

  // show calculating status/timer
  const abortRef = useRef(null);
  const [calcElapsed, setCalcElapsed] = useState(0);
  const [calcStage, setCalcStage] = useState("");
  const cancelCalculation = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setComputeAccessibility(false);
    setIsCalculating(false);
    setCalcStage("");
  };

  // (1) timer (Ns)
  useEffect(() => {
    if (!isCalculating) {
      setCalcElapsed(0);
      return;
    }
    const start = Date.now();
    const timer = window.setInterval(() => {
      setCalcElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isCalculating]);

  // (2) Esc to cancel
  useEffect(() => {
    if (!isCalculating) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelCalculation();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isCalculating]);

  // load city boundary
  useEffect(() => {
    Promise.all([
      fetch(`/data/penteli/penteli_boundary.geojson`).then(res => res.json()),
      fetch(`/data/hamburg/hamburg_boundary.geojson`).then(res => res.json())
    ]).then(([hh, pt]) => {
      setCityBoundaries({ hamburg: hh, penteli: pt });
    });
  }, []);

  // check if the generated reachability area is valid GeoJSON
  const isValidGeoJSON = (geojson) =>
    geojson &&
    geojson.type === "FeatureCollection" &&
    Array.isArray(geojson.features) &&
    geojson.features.length > 0;

  const buildBufferedAreaWithTiming = (roads, bufferDistance, contourSettings, phaseLabel) => {
    const runId = `${phaseLabel}-${Date.now()}`;

    const combineStart = `accessibility-combine-start-${runId}`;
    const combineEnd = `accessibility-combine-end-${runId}`;
    markPerformance(combineStart);
    const fc = turf.featureCollection(roads);
    const combined = turf.combine(fc);
    markPerformance(combineEnd);
    const combineMs = measurePerformance(
      `accessibility:turf:combine:${phaseLabel}`,
      combineStart,
      combineEnd
    );

    const simplifyStart = `accessibility-simplify-start-${runId}`;
    const simplifyEnd = `accessibility-simplify-end-${runId}`;
    markPerformance(simplifyStart);
    const simplified = turf.simplify(combined, {
      tolerance: contourSettings.tolerance,
      highQuality: contourSettings.highQuality
    });
    markPerformance(simplifyEnd);
    const simplifyMs = measurePerformance(
      `accessibility:turf:simplify:${phaseLabel}`,
      simplifyStart,
      simplifyEnd
    );

    const bufferStart = `accessibility-buffer-start-${runId}`;
    const bufferEnd = `accessibility-buffer-end-${runId}`;
    markPerformance(bufferStart);
    const buffered = turf.buffer(simplified, bufferDistance, {
      units: "kilometers",
      steps: contourSettings.steps
    });
    markPerformance(bufferEnd);
    const bufferMs = measurePerformance(
      `accessibility:turf:buffer:${phaseLabel}`,
      bufferStart,
      bufferEnd
    );

    const areaStart = `accessibility-area-start-${runId}`;
    const areaEnd = `accessibility-area-end-${runId}`;
    markPerformance(areaStart);
    const cleaned = {
      type: "FeatureCollection",
      features: buffered.features.map((f) => {
        if (f.geometry.type === "Polygon") {
          return turf.polygon([f.geometry.coordinates[0]]);
        }
        if (f.geometry.type === "MultiPolygon") {
          return turf.multiPolygon(f.geometry.coordinates.map((p) => [p[0]]));
        }
        return f;
      })
    };

    let areaSquareMeters = 0;
    cleaned.features.forEach((feature) => {
      areaSquareMeters += turf.area(feature);
    });
    markPerformance(areaEnd);
    const areaMs = measurePerformance(
      `accessibility:turf:area:${phaseLabel}`,
      areaStart,
      areaEnd
    );

    const turfProcessingMs = Number((combineMs + simplifyMs + bufferMs + areaMs).toFixed(2));

    return {
      cleaned,
      areaHectares: areaSquareMeters / 10000,
      timings: {
        combineMs,
        simplifyMs,
        bufferMs,
        areaMs,
        turfProcessingMs,
      }
    };
  };

  const logAccessibilityTiming = (phaseLabel, requestTiming, turfTiming, inputGeometryStats) => {
    const serverTiming = requestTiming?.serverTiming || {};
    const fetchAndParseMs = Number((requestTiming?.fetchAndParseMs || 0).toFixed(2));
    const apiTotalMs = Number((serverTiming.apiTotalMs || 0).toFixed(2));
    const routingQueryMs = Number((serverTiming.routingQueryMs || 0).toFixed(2));
    const apiOverheadMs = Number((serverTiming.apiOverheadMs || 0).toFixed(2));
    const networkAndBrowserParseMs = Math.max(
      0,
      Number((fetchAndParseMs - apiTotalMs).toFixed(2))
    );
    const turfProcessingMs = Number((turfTiming?.turfProcessingMs || 0).toFixed(2));
    const postServerToClientReadyMs = Number(
      (networkAndBrowserParseMs + turfProcessingMs).toFixed(2)
    );

    console.groupCollapsed(`[accessibility timing] ${phaseLabel}`);
    console.table({
      routingQueryMs,
      apiOverheadMs,
      nearestVertexMs: Number((serverTiming.nearestVertexMs || 0).toFixed(2)),
      apiTotalMs,
      fetchAndParseMs,
      networkAndBrowserParseMs,
      postServerToClientReadyMs,
      featureCount: inputGeometryStats?.featureCount || 0,
      coordinateCount: inputGeometryStats?.coordinateCount || 0,
      combineMs: Number((turfTiming?.combineMs || 0).toFixed(2)),
      simplifyMs: Number((turfTiming?.simplifyMs || 0).toFixed(2)),
      bufferMs: Number((turfTiming?.bufferMs || 0).toFixed(2)),
      areaMs: Number((turfTiming?.areaMs || 0).toFixed(2)),
      turfProcessingMs,
      endToEndMs: Number((fetchAndParseMs + turfProcessingMs).toFixed(2)),
    });
    console.groupEnd();
  };

  // Unified buffer/simplify profile for all cities.
  // It adapts to input size (number of reachable road segments), not city id.
  const getContourSettings = (featureCount) => {
    if (featureCount > 4000) {
      return { tolerance: 0.00014, highQuality: false, steps: 12 };
    }
    if (featureCount > 1500) {
      return { tolerance: 0.0001, highQuality: false, steps: 14 };
    }
    return { tolerance: 0.00007, highQuality: true, steps: 16 };
  };

  const colorPool = [
    "#f53c16", "#584898", "#c69a43 ", "#0fa321", "#924467"
  ]; // color pool for different calculation results/ accessibility analysis

  // Load Leaflet and React-Leaflet dynamically to avoid SSR issues
  useEffect(() => {
    async function loadLibs() {
      const leaflet = await import("leaflet");
      setCustomMarkerIcon(
        new leaflet.Icon({
          iconUrl: "/images/address_start.png",
          iconSize: [32, 32],
          iconAnchor: [16, 32], 
          popupAnchor: [0, -32],  
        })
      );

      const rleaflet = await import("react-leaflet");
      setMapModule(rleaflet);
    }
    loadLibs();
  }, []);

  //selectingStart is true when the user clicks the "Select Start Point" button
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
  
    if (selectingStart) {
      window.addEventListener('mousemove', handleMouseMove);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
    }
  
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [selectingStart]);
  
  // Reset the state when resetTrigger changes 
  useEffect(() => {
    if (resetTrigger) {
      setStartPoints([]); 
      onResetHandled && onResetHandled(); 
    }
  }, [resetTrigger, onResetHandled]);  

  // clean "get catchment area" result
  useEffect(() => {
    if (clearTrigger) {
      setReachableHullData([]);
      setResultMetadata([]);
      setDefaultGroupIndex([]);
      setDefaultResultCache([]);
      setGroupMapping([]);
      onClearHandled?.();
    }
  }, [clearTrigger, onClearHandled]);

  // Load GeoJSON data for the selected layers (sidebar map layers)
  useEffect(() => {
    const loadGeoJsonData = async () => {
      const newGeoJsonData = {};

      const filteredSelectedLayers = selectedLayers.filter((layer) =>
        availableLayerKeys.has(layer)
      );

      const expandedLayers = filteredSelectedLayers.flatMap(layer => {
        if (selectedCity === "hamburg" && layer === "facility_hh") {
          return HAMBURG_FACILITY_POI_LAYERS.filter(
            (poiLayer) => poiLayer !== EXCLUDED_HAMBURG_FACILITY_POI
          );
        }
        return layerGroupMap[layer] || [layer]; // Expand the tactile_guidance and other grouped layers
      });

      for (const layer of expandedLayers) { 
        if (isWmsLayer(layer, layerTypeMap)) continue;

        try {
          const filePath = layer.startsWith("poi_")
            ? `/data/POI/${layer}.geojson`
            : `/data/${selectedCity}/${layer}.geojson`;
          const res = await fetch(filePath);
          const data = await res.json();
          newGeoJsonData[layer] = data;
        } catch (err) {
          console.error("Failed to load:", layer, err);
        }
      }

      setGeoJsonData((prev) => {
        const preservedPoiData = Object.fromEntries(
          Object.entries(prev).filter(([key]) => key.startsWith("poi_"))
        );
        return {
          ...preservedPoiData,
          ...newGeoJsonData
        };
      });
    };

    loadGeoJsonData();
   }, [selectedLayers, selectedCity, layerTypeMap, availableLayerKeys]);
  
  // Fetch accessibility data from the backend 
  const fetchAccessibilityFromBackend = async (
    lat,
    lon,
    time,
    speed,
    variableSettings,
    signal,
    phaseLabel
  ) => {
    try {
      const selected = enabledVariables || [];

      const params = new URLSearchParams({
        lat, lon, time, speed,
        noise: selected.includes("noise") ? variableSettings.noise ?? 1 : 1,
        light: selected.includes("light") ? variableSettings.light ?? 1 : 1,
        trafficLight: selected.includes("trafficLight") ? variableSettings.trafficLight ?? 1 : 1,
        tactile: selected.includes("tactile_pavement") ? variableSettings.tactile_pavement ?? 1 : 1,
        tree: selected.includes("tree") ? variableSettings.tree ?? 1 : 1,
        temperatureSummer: selected.includes("temperatureSummer") ? variableSettings.temperatureSummer ?? 1 : 1,
        temperatureWinter: selected.includes("temperatureWinter") ? variableSettings.temperatureWinter ?? 1 : 1,
        blueinf: selected.includes("blueinf") ? variableSettings.blueinf ?? 1 : 1,
        greeninf: selected.includes("greeninf") ? variableSettings.greeninf ?? 1 : 1,
        station: selected.includes("station") ? variableSettings.station ?? 1 : 1,
        wcDisabled: selected.includes("wcDisabled") ? variableSettings.wcDisabled ?? 1 : 1,
        narrowRoads: selected.includes("narrowRoads") ? variableSettings.narrowRoads ?? 1 : 1,
        stair: selected.includes("stair") ? variableSettings.stair ?? 1 : 1,
        obstacle: selected.includes("obstacle") ? variableSettings.obstacle ?? 1 : 1,
        slope: selected.includes("slope") ? variableSettings.slope ?? 1 : 1,
        slope_penteli: selected.includes("slope_penteli") ? variableSettings.slope_penteli ?? 1 : 1,
        unevenSurface: selected.includes("unevenSurface") ? variableSettings.unevenSurface ?? 1 : 1,
        poorPavement: selected.includes("poorPavement") ? variableSettings.poorPavement ?? 1 : 1,
        kerbsHigh: selected.includes("kerbsHigh") ? variableSettings.kerbsHigh ?? 1 : 1,
        facility: selected.includes("facility") ? variableSettings.facility ?? 1 : 1,
        pedestrianFlow: selected.includes("pedestrianFlow") ? variableSettings.pedestrianFlow ?? 1 : 1
      });
      params.append("n", Math.max(1, selected.length));

      params.append("city", selectedCity);

      const runId = `${phaseLabel}-${Date.now()}`;
      const fetchStart = `accessibility-fetch-start-${runId}`;
      const fetchEnd = `accessibility-fetch-end-${runId}`;
      const measureName = `accessibility:fetch:${phaseLabel}`;
      markPerformance(fetchStart);
      const res = await fetch(`/api/accessibility?${params}`, { signal });
      if (!res.ok) throw new Error("API call failed");
      const data = await res.json();
      markPerformance(fetchEnd);
      const fetchAndParseMs = measurePerformance(measureName, fetchStart, fetchEnd);
      return {
        ...data,
        requestTiming: {
          fetchAndParseMs,
          serverTiming: data?.timing || null,
        }
      };
    } catch (err) {
      if (err?.name === "AbortError") throw err;
      console.error("Failed to obtain reachability area:", err);
      return null;
    }
  };  

  // POI/amenities summary in catchment area
  const POI_LAYER_CONFIG = {
    hamburg: HAMBURG_FACILITY_POI_LAYERS.filter(
      (poiLayer) => poiLayer !== EXCLUDED_HAMBURG_FACILITY_POI
    ),
    penteli: [
      "poi_pt_education",
      "poi_pt_gastronomy",
      "poi_pt_haltstelle",
      "poi_pt_health",
      "poi_pt_library",
      "poi_pt_music_exhibition",
      "poi_pt_other",
      "poi_pt_religious"
    ]
  };

  const countPoisInArea = (areaGeoJson) => {
    const poiLayers = POI_LAYER_CONFIG[selectedCity] || [];

    let poiGroupCounts = {};
    let totalPOI = 0;

    for (const layerName of poiLayers) {
      const poiData = geoJsonData[layerName];
      if (!poiData || !areaGeoJson.features.length) continue;

      const filteredPOI = poiData.features.filter(
        (f) => f.geometry.type === "Point"
      );

      const inArea = filteredPOI.filter((f) =>
        areaGeoJson.features.some((polygon) =>
          turf.booleanPointInPolygon(f, polygon)
        )
      );

      poiGroupCounts[layerName] = inArea.length;
      totalPOI += inArea.length;
    }

    return { poiGroupCounts, totalPOI };
  };

  useEffect(() => {
    const loadPOIGeoJsons = async () => {
      const poiLayers = POI_LAYER_CONFIG[selectedCity] || [];
      const newData = {};

      for (const layer of poiLayers) {
        try {
          const res = await fetch(`/data/POI/${layer}.geojson`);
          const data = await res.json();
          newData[layer] = data;
        } catch (err) {
          console.error("Failed to load:", layer, err);
        }
      }

      setGeoJsonData((prev) => ({
        ...prev,
        ...newData
      }));
    };

    loadPOIGeoJsons();
  }, [selectedCity]);

  // Perform reachability analysis, calculate road features and hulls
  useEffect(() => {
    const performAnalysis = async () => {
      if (startPoints.length === 0) return;
      const [lon, lat] = startPoints[startPoints.length - 1]; // latest point
      const key = `${lat},${lon},${walkingTime},${walkingSpeed}`; //store basic parameters for default catchment area
      setIsCalculating(true);
      const controller = new AbortController();
      abortRef.current = controller;
      setCalcStage(t('loading'));

      try {
        let defaultArea;
        let currentGroupIndex;

        const bufferDistance = selectedCity === "penteli" ? 0.1 : 0.02;

        // --------- Step 1: Default Result (only speed/time/start) ---------
        if (!defaultResultCache[key]) {
          const newGroupIndex = Object.keys(groupMapping).length + 1;
          setGroupMapping(prev => ({ ...prev, [key]: newGroupIndex }));
          setDefaultGroupIndex(newGroupIndex);
          currentGroupIndex = newGroupIndex;

          const defaultVars = {
            noise: 1, light: 1, trafficLight: 1,
            tactile_pavement: 1, tree: 1,
            temperatureSummer: 1, temperatureWinter: 1
          };

          const defaultRes = await fetchAccessibilityFromBackend(
            lat,
            lon,
            walkingTime,
            walkingSpeed,
            defaultVars,
            controller.signal,
            "default"
          );
          if (!defaultRes || !defaultRes.roads) {
            alert(t("err_api_failed_try_again"));
            setComputeAccessibility(false);
            setIsCalculating(false);
            return;
          }
          if (!isValidGeoJSON(defaultRes.roads)) {
            alert(t("err_no_reachable_default"));
            setComputeAccessibility(false);
            setIsCalculating(false);
            return;
          }
          const defaultRoads = defaultRes.roads.features;
          const contourSettings = getContourSettings(defaultRoads.length);
          const defaultProcessing = buildBufferedAreaWithTiming(
            defaultRoads,
            bufferDistance,
            contourSettings,
            "default"
          );
          const cleaned = defaultProcessing.cleaned;
          defaultArea = defaultProcessing.areaHectares;
          logAccessibilityTiming(
            "default",
            defaultRes.requestTiming,
            defaultProcessing.timings,
            {
              featureCount: defaultRoads.length,
              coordinateCount: countCoordinates(defaultRoads),
            }
          );

          setDefaultResultCache(prev => ({ ...prev, [key]: { roads: defaultRes.roads, hull: cleaned, area: defaultArea } }));
          setReachableHullData(prev => [...prev, cleaned]);
 
          const { poiGroupCounts, totalPOI } = countPoisInArea(cleaned);

          setResultMetadata(prev => [
            ...prev,
            {
              color: "#676767ff", // default color for the first result
              layers: [],
              values: {},
              time: walkingTime,
              speed: walkingSpeed,
              area: defaultArea.toFixed(2),
              poiCount: totalPOI,
              poiGroupCounts,
              isDefault: true,
              groupIndex: newGroupIndex
            }
          ]);
        } else {
          currentGroupIndex = groupMapping[key];
          setDefaultGroupIndex(currentGroupIndex);
          defaultArea = defaultResultCache[key].area;
        }

        // --------- Step 2: Weighted Result (with comfort features) ---------
        const weightedEqualsDefault =
          enabledVariables.length > 0 &&
          enabledVariables.every((layer) => Number(layerValues?.[layer] ?? 1) === 1);

        if (enabledVariables.length > 0 && !weightedEqualsDefault) {
          const weightedRes = await fetchAccessibilityFromBackend(
            lat,
            lon,
            walkingTime,
            walkingSpeed,
            layerValues,
            controller.signal,
            "weighted"
          );
          if (!weightedRes || !weightedRes.roads) {
            alert(t("err_api_failed_try_again"));
            return;
          }
          if (!isValidGeoJSON(weightedRes.roads)) {
            alert(t("err_no_reachable_weighted"));
            return;
          }
          const weightedRoads = weightedRes.roads.features;
          const contourSettings2 = getContourSettings(weightedRoads.length);
          const weightedProcessing = buildBufferedAreaWithTiming(
            weightedRoads,
            bufferDistance,
            contourSettings2,
            "weighted"
          );
          const cleaned2 = weightedProcessing.cleaned;
          let weightedArea = weightedProcessing.areaHectares;
          logAccessibilityTiming(
            "weighted",
            weightedRes.requestTiming,
            weightedProcessing.timings,
            {
              featureCount: weightedRoads.length,
              coordinateCount: countCoordinates(weightedRoads),
            }
          );

          const ratio = (weightedArea / defaultArea).toFixed(2);
          const color = colorPool[resultMetadata.length % colorPool.length];

          setReachableHullData(prev => [...prev, cleaned2]);
 
          const { poiGroupCounts, totalPOI } = countPoisInArea(cleaned2);

          setResultMetadata(prev => [
            ...prev,
            {
              color,
              layers: enabledVariables,
              values: { ...layerValues },
              time: walkingTime,
              speed: walkingSpeed,
              area: weightedArea.toFixed(2),
              weightedRatio: ratio,
              poiCount: totalPOI,
              poiGroupCounts,
              isDefault: false,
              groupIndex: currentGroupIndex,
              subIndex: prev.filter(p => p.groupIndex === currentGroupIndex && !p.isDefault).length + 1
            }
          ]);
        }

      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("Reachability analysis error：", err);
        alert(t("err_unexpected_try_again"));
      } finally {
        abortRef.current = null;
        setIsCalculating(false);
        setCalcStage("");
        setComputeAccessibility(false);
      }
    };
  
    if (computeAccessibility) {
      performAnalysis();
    }
  }, [computeAccessibility]); 

  // handle legend click to focus on a specific area
  const handleFocusArea = (idx) => {
    if (!reachableHullData[idx]) return;
    const L = require("leaflet");
    const map = document.querySelector(".leaflet-container")?._leaflet_map;
    if (!map) return;
    map.fitBounds(L.geoJSON(reachableHullData[idx]).getBounds(), { padding: [40, 40] });
    setHighlightedIndex(idx);   
    console.log("setHighlightedIndex to", idx);
  };

  useEffect(() => {
    const root = document.querySelector("." + sty.leafletMap);
    if (!root) return;

    const apply = () => {
      // Attribution links: keep out of tab order (as you already do)
      root 
        .querySelectorAll(".leaflet-control-attribution a")
        .forEach((a) => a.setAttribute("tabindex", "-1"));

      // Zoom controls: ensure stable accessible name (and role if you want)
      const zoomIn = root.querySelector("a.leaflet-control-zoom-in");
      const zoomOut = root.querySelector("a.leaflet-control-zoom-out");

      if (zoomIn) {
        zoomIn.setAttribute(
          "aria-label",
          t("aria_zoom_in")
        );
        zoomIn.setAttribute("role", "button");
      }

      if (zoomOut) {
        zoomOut.setAttribute(
          "aria-label",
          t("aria_zoom_out")
        );
        zoomOut.setAttribute("role", "button");
      }
    };

    apply();

    const obs = new MutationObserver(apply);
    obs.observe(root, { subtree: true, childList: true });

    return () => obs.disconnect();
  }, [t]);

  if (!MapModule || !MapModule.MapContainer) return null;
  const { MapContainer, TileLayer, GeoJSON, Marker, Popup, Tooltip, useMapEvents, useMap, Pane } = MapModule;

  // Listen for map click events
  // This component handles the click event on the map to select the starting point
  const MapClickHandler = () => {
    useMapEvents({ 
      click: (e) => {
        if (selectingStart) {
          const [lon, lat] = [e.latlng.lng, e.latlng.lat];
          console.log("Selected starting point：", [lon, lat]);
          setStartPoints(prev => [...prev, [lon, lat]]);
          setSelectingStart(false);
        }
      }
      
    });
    return null;
  };

  // zoom to selected start point
  function AutoZoomToStart({ startPoints, isSearchZoom, setIsSearchZoom }) {
    const map = useMap();
    useEffect(() => {
      if (isSearchZoom && startPoints.length > 0) {
        const [lon, lat] = startPoints[startPoints.length - 1];
        map.setView([lat, lon], 16);
        setIsSearchZoom(false);
      }
    }, [startPoints, isSearchZoom, setIsSearchZoom, map]);
    return null;
  }

  function MakeMapKeyboardAccessible() {
    const map = useMap();

    useEffect(() => {
      if (!map) return;
      const el = map.getContainer();

      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");

      el.setAttribute("aria-label", t("aria_interactive_map"));
      el.setAttribute("aria-describedby", "map-kbd-desc");
    }, [map, t]);

    return null;
  }

  return (
    <section
      id="map-region"
      tabIndex={-1}
      className="mapBox"
      style={{ position: "relative" }}
      aria-label={mapRegionLabel}
      role="region"
    >
      {/* Show loading overlay when calculating */}
      {/* for screen reader */}
      <div className={sty.visuallyHidden} aria-live="polite" role="status">
        {isCalculating && t('sr_isCalculating')}
        {selectingStart && t('sr_selectingStart')}
      </div>

      {/* normal user */}
      {isCalculating && (
        <div className={sty.loadingOverlay} role="status" aria-live="polite">
          <div className={sty.loadingPanel}>
            <div className={sty.spinnerContainer}>
              <div className={sty.spinnerCircle} aria-hidden="true"></div>

              <div className={sty.loadingText}>
                {calcStage || t('loading')} <span aria-hidden="true">({calcElapsed}s)</span>
              </div>
            </div>

            <div className={sty.loadingHint}>
              {t('loading_cancle')}
            </div>
          </div>
        </div>
      )}

      {selectingStart && (
        <div
          className={sty.mouseHint}
          style={{
            top: mousePosition.y,
            left: mousePosition.x
          }}
          aria-hidden="true"
        >
          <img
            src="/images/address_start.png"
            alt=""
            className={sty.mouseHintIcon}
            draggable="false"
          />
        </div>
      )}

      <p id="map-kbd-desc" className={sty.srOnly}>
        {t("sr_map_keyboard_instructions")}
      </p>
      <MapContainer
        center={cityCenter}
        zoom={14}
        className={sty.leafletMap}
        keyboard={true}
        zoomControl={true}
        attributionControl={false}
      >
        <Pane name="highlight-pane" style={{ zIndex: 650 }} />
        <AutoZoomToStart
          startPoints={startPoints}
          isSearchZoom={isSearchZoom}
          setIsSearchZoom={setIsSearchZoom}
        />
        <MakeMapKeyboardAccessible />
        <TileLayer
          //different base map

          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"

          // attribut5ion='&copy; <a href="https://www.esri.com/">Esri</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          // url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
 
          // attribution='&copy; <a href="https://www.jawg.io/">Jawg Maps</a>, &copy; OpenStreetMap contributors'
          // url="https://tile.jawg.io/jawg-light/{z}/{x}/{y}{r}.png?access-token=N8tyqxwOfghCwYKUCRWMrtYjDEs1VLvvtwYHg5MhjaJyatpgD5OGoH7O94u901Ko"
        />
        <MapClickHandler /> 

        {startPoints.map((pt, i) => (
          customMarkerIcon ? (
            <Marker key={`start-${i}`} position={[pt[1], pt[0]]} icon={customMarkerIcon}>
              <Popup>Analysis starting point {i + 1}</Popup>
            </Marker>
          ) : null
        ))}

        {/* render boundary */}
        {cityBoundaries.hamburg && (
          <GeoJSON
            data={cityBoundaries.hamburg}
            style={{
              color: "#846bfb",
              weight: 2,
              fillOpacity: 0,
              dashArray: "5,5"
            }}
          />
        )}
        {cityBoundaries.penteli && (
          <GeoJSON
            data={cityBoundaries.penteli}
            style={{
              color: "#846bfb",
              weight: 2,
              fillOpacity: 0,
              dashArray: "5,5"
            }}
          />
        )}
 
        {/* Render WMS layers based on selectedLayers */}
        {selectedLayers.map((layer) => {
          if (!isWmsLayer(layer, layerTypeMap)) return null;
          const WmsComponent = wmsLayerComponents[layer];
          return WmsComponent ? <WmsComponent key={layer} /> : null;
        })}

        {/* Render Geojson Layers based on selectedLayers*/}
        {Object.entries(geoJsonData).map(([layer, data]) => {
          if (selectedCity === "hamburg" && layer === EXCLUDED_HAMBURG_FACILITY_POI) {
            return null;
          }
          const isPoiLayer = layer.startsWith("poi_");
          const isHamburgFacilityPoiVisible =
            selectedCity === "hamburg" &&
            selectedLayers.includes("facility_hh") &&
            HAMBURG_FACILITY_POI_LAYERS.includes(layer);
          if (isPoiLayer && !selectedLayers.includes(layer) && !isHamburgFacilityPoiVisible) {
            return null;
          }
          return (
            <GeoJSON
              key={layer}
              data={data}
              pointToLayer={(feature, latlng) => {
                const L = require("leaflet");
                return L.circleMarker(latlng, getStyle(layer, feature));
              }}
              style={(feature) => getStyle(layer, feature)}
            />
          )
        })}

        {/* Legend */}
        <Legend 
          resultMetadata={resultMetadata} 
          onFocusArea={handleFocusArea}
        />
 
        {/* Render reachable hulls */}
        {reachableHullData.map((hull, i) =>
          isValidGeoJSON(hull) ? (
            <GeoJSON
              key={`hull-${i}`}
              data={hull}
              style={{
                color: resultMetadata[i]?.color || "#0072bd",
                fillColor: resultMetadata[i]?.color || "#0072bd",
                fillOpacity: 0.1,
                weight: 2,
                opacity: 1
              }}
            >
              {/* Tooltip for result name */}
              <Tooltip sticky direction="top" offset={[6, -6]}>
                {resultMetadata[i]?.isDefault
                  ? `${t("legend_base_area")} ${resultMetadata[i]?.groupIndex}`
                  : `${t("legend_adjusted_area")} ${resultMetadata[i]?.groupIndex}.${resultMetadata[i]?.subIndex}`}
              </Tooltip>

            </GeoJSON>
          ) : null
        )}
        {highlightedIndex !== null && reachableHullData[highlightedIndex] && (
          <GeoJSON
            key={`highlighted-${highlightedIndex}`}
            data={reachableHullData[highlightedIndex]}
            style={{
              color: "#e63946",
              fillColor: "#e63946",
              weight: 3,
              dashArray: "5",
              fillOpacity: 0.7,
              opacity: 1
            }}
            pane="highlight-pane"
          />
        )}
        
         
      </MapContainer>
    </section>
  );
};

export default MapComponent;
