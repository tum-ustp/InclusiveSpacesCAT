import { useEffect, useRef, useState } from "react";
import * as turf from "@turf/turf";
import { HAMBURG_FACILITY_POI_LAYERS } from "../poiConfig";
import {
  markPerformance,
  measurePerformance,
  countCoordinates,
  buildBufferedAreaWithTiming,
  logAccessibilityTiming,
  getContourSettings,
} from "./performance";

const EXCLUDED_HAMBURG_FACILITY_POI = "poi_hh_haltstelle";
const ACCESSIBILITY_GEOMETRY_MODE = "simplified";
const ACCESSIBILITY_FRONTIER_DEPTH_METERS = {
  default: {
    hamburg: 320,
    penteli: 500,
  },
  weighted: {
    hamburg: 260,
    penteli: 420,
  },
};
const ACCESSIBILITY_FRONTIER_INNER_STREET_PADDING = {
  default: {
    hamburg: 3,
    penteli: 3,
  },
  weighted: {
    hamburg: 3,
    penteli: 3,
  },
};

// check if the generated reachability area is valid GeoJSON
export const isValidGeoJSON = (geojson) =>
  geojson &&
  geojson.type === "FeatureCollection" &&
  Array.isArray(geojson.features) &&
  geojson.features.length > 0;

const colorPool = [
  "#f53c16", "#584898", "#c69a43 ", "#0fa321", "#924467"
]; // color pool for different calculation results/ accessibility analysis

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

export const useCatchmentArea = ({
  selectedCity,
  enabledVariables,
  walkingTime,
  walkingSpeed,
  startPoints,
  computeAccessibility,
  setComputeAccessibility,
  clearTrigger,
  onClearHandled,
  layerValues,
  geoJsonData,
  setGeoJsonData,
  t,
}) => {
  const [reachableRoadsData, setReachableRoadsData] = useState([]);
  const [reachableHullData, setReachableHullData] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false); // function attachment calculation works?
  const [resultMetadata, setResultMetadata] = useState([]); // store metadata for each result/ user setting each time
  const [defaultResultCache, setDefaultResultCache] = useState({}); // key: `${lat},${lon}`, value: {roads, hull, area}
  const [, setDefaultGroupIndex] = useState(1);  // default group index for the first result
  const [groupMapping, setGroupMapping] = useState({}); // mapping of group index to default results,index for weighted results
  const [surveyInviteTrigger, setSurveyInviteTrigger] = useState(0);

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

  const requestSurveyInvite = () => {
    setSurveyInviteTrigger((prev) => prev + 1);
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

  // clean "get catchment area" result
  useEffect(() => {
    if (clearTrigger) {
      setReachableRoadsData([]);
      setReachableHullData([]);
      setResultMetadata([]);
      setDefaultGroupIndex([]);
      setDefaultResultCache([]);
      setGroupMapping([]);
      onClearHandled?.();
    }
  }, [clearTrigger, onClearHandled]);

  // Fetch accessibility data from the backend
  const fetchAccessibilityFromBackend = async (lat, lon, time, speed, variableSettings, signal, phaseLabel) => {
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
      params.append("geometry", ACCESSIBILITY_GEOMETRY_MODE);
      const frontierDepthByPhase =
        ACCESSIBILITY_FRONTIER_DEPTH_METERS[phaseLabel] ||
        ACCESSIBILITY_FRONTIER_DEPTH_METERS.weighted;
      const frontierPaddingByPhase =
        ACCESSIBILITY_FRONTIER_INNER_STREET_PADDING[phaseLabel] ||
        ACCESSIBILITY_FRONTIER_INNER_STREET_PADDING.weighted;
      params.append(
        "frontierDepth",
        frontierDepthByPhase[selectedCity] ?? frontierDepthByPhase.hamburg
      );
      params.append(
        "frontierInnerStreetPadding",
        frontierPaddingByPhase[selectedCity] ?? frontierPaddingByPhase.hamburg
      );

      const runId = `${phaseLabel}-${Date.now()}`;
      const startMark = `accessibility-fetch-start-${runId}`;
      const endMark = `accessibility-fetch-end-${runId}`;
      const measureName = `accessibility:fetch:${phaseLabel}`;
      markPerformance(startMark);
      const res = await fetch(`/api/accessibility?${params}`, { signal });
      if (!res.ok) throw new Error("API call failed");
      const data = await res.json();
      markPerformance(endMark);
      measurePerformance(measureName, startMark, endMark);

      return {
        ...data,
        requestTiming: {
          fetchAndParseMs:
            typeof performance !== "undefined"
              ? Number((performance.getEntriesByName(measureName).at(-1)?.duration || 0).toFixed(2))
              : 0,
          serverTiming: data?.timing || null,
        }
      };
    } catch (err) {
      if (err?.name === "AbortError") throw err;
      console.error("Failed to obtain reachability area:", err);
      return null;
    }
  };

  const countPOIsInArea = (areaGeoJson) => {
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
      let shouldShowSurveyPrompt = false;
      setIsCalculating(true);
      const controller = new AbortController();
      abortRef.current = controller;
      setCalcStage(t('loading'));

      try {
        let defaultArea;
        let currentGroupIndex;

        const bufferDistance = selectedCity === "penteli" ? 0.1 : 0.02;

        // --------- Step 1: Default Reslut (only speed/time/start) ---------
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
          setReachableRoadsData(prev => [...prev, defaultRes.roads]);
          setReachableHullData(prev => [...prev, cleaned]);

          const { poiGroupCounts, totalPOI } = countPOIsInArea(cleaned);

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
          shouldShowSurveyPrompt = true;
        } else {
          currentGroupIndex = groupMapping[key];
          setDefaultGroupIndex(currentGroupIndex);
          defaultArea = defaultResultCache[key].area;
          shouldShowSurveyPrompt = true;
        }

        // --------- Step 2: Weighted Result (with comfort features) ---------
        if (enabledVariables.length > 0) {
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

          setReachableRoadsData(prev => [...prev, weightedRes.roads]);
          setReachableHullData(prev => [...prev, cleaned2]);

          const { poiGroupCounts, totalPOI } = countPOIsInArea(cleaned2);

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
        console.error("Reachability analysis errorпјљ", err);
        alert(t("err_unexpected_try_again"));
      } finally {
        abortRef.current = null;
        setIsCalculating(false);
        setCalcStage("");
        setComputeAccessibility(false);
        if (shouldShowSurveyPrompt) {
          requestSurveyInvite();
        }
      }
    };

    if (computeAccessibility) {
      performAnalysis();
    }
  }, [computeAccessibility]);

  return {
    reachableRoadsData,
    reachableHullData,
    isCalculating,
    resultMetadata,
    surveyInviteTrigger,
    calcElapsed,
    calcStage,
    isValidGeoJSON,
  };
};
