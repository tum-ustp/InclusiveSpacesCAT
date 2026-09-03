import { useCallback, useEffect, useRef, useState } from "react";
import * as turf from "@turf/turf";
import { layerGroupMap } from "../LayerStyleManager";
import {
  markPerformance,
  measurePerformance,
  countCoordinates,
  buildBufferedAreaWithTiming,
  logAccessibilityTiming,
} from "./performance";

const ACCESSIBILITY_GEOMETRY_MODE = "simplified";

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
  hamburg: layerGroupMap.facility_hh || [],
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
  const [defaultResultCache, setDefaultResultCache] = useState({}); // key: `${lat},${lon}`, value: {network, hull, area}
  const [, setDefaultGroupIndex] = useState(1);  // default group index for the first result
  const [groupMapping, setGroupMapping] = useState({}); // mapping of group index to default results,index for weighted results

  // show calculating status/timer
  const abortRef = useRef(null);
  const [calcElapsed, setCalcElapsed] = useState(0);
  const [calcStage, setCalcStage] = useState("");
  const [calcQueueStatus, setCalcQueueStatus] = useState(null);
  const cancelCalculation = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setComputeAccessibility(false);
    setIsCalculating(false);
    setCalcStage("");
    setCalcQueueStatus(null);
  }, [setComputeAccessibility]);

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
  }, [isCalculating, cancelCalculation]);

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
  const fetchAccessibilityFromBackend = async ({
    lat,
    lon,
    time,
    speed,
    variableSettings,
    signal,
    mode = "default",
    queueGroupId,
    queueGroupSize = 1,
  }) => {
    try {
      const selected = enabledVariables || [];
      const requestId = `${mode}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
      params.append("mode", mode);
      params.append("requestId", requestId);
      if (queueGroupId) {
        params.append("queueGroupId", queueGroupId);
        params.append("queueGroupSize", String(queueGroupSize));
      }

      const runId = `${mode}-${Date.now()}`;
      const startMark = `accessibility-fetch-start-${runId}`;
      const endMark = `accessibility-fetch-end-${runId}`;
      const measureName = `accessibility:fetch:${mode}`;
      let queueStatusTimer = null;
      const updateQueueStatus = async () => {
        try {
          const statusRes = await fetch(`/api/accessibility?queueStatusId=${encodeURIComponent(requestId)}`);
          if (statusRes.ok) {
            setCalcQueueStatus(await statusRes.json());
          }
        } catch (err) {
          console.warn("Failed to update accessibility queue status", err);
        }
      };

      setCalcQueueStatus({
        id: requestId,
        status: "queued",
        activeCount: 0,
        queuedCount: 0,
        queuePosition: null,
      });

      updateQueueStatus();
      if (typeof window !== "undefined") {
        queueStatusTimer = window.setInterval(updateQueueStatus, 2000);
      }

      markPerformance(startMark);
      let data;
      try {
        const res = await fetch(`/api/accessibility?${params}`, { signal });
        if (!res.ok) throw new Error("API call failed");
        data = await res.json();
        markPerformance(endMark);
        measurePerformance(measureName, startMark, endMark);
      } finally {
        if (queueStatusTimer) {
          window.clearInterval(queueStatusTimer);
        }
      }

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
          newData[layer] = await res.json();
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
  }, [selectedCity, setGeoJsonData]);

  // Perform reachability analysis, calculate road features and hulls
  useEffect(() => {
    const performAnalysis = async () => {
      if (startPoints.length === 0) return;
      const [lon, lat] = startPoints[startPoints.length - 1]; // latest point
      const key = `${lat},${lon},${walkingTime},${walkingSpeed}`; //store basic parameters for default catchment area
      const needsDefaultCalculation = !defaultResultCache[key];
      setIsCalculating(true);
      const controller = new AbortController();
      abortRef.current = controller;
      setCalcStage(t('loading'));
      const queueGroupId = `analysis-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const queueGroupSize = needsDefaultCalculation && enabledVariables.length > 0 ? 2 : 1;

      try {
        let defaultArea;
        let currentGroupIndex;
        let weightedResPromise = null;

        // --------- Step 1: Default Reslut (only speed/time/start) ---------
        if (needsDefaultCalculation) {
          const newGroupIndex = Object.keys(groupMapping).length + 1;
          setGroupMapping(prev => ({ ...prev, [key]: newGroupIndex }));
          setDefaultGroupIndex(newGroupIndex);
          currentGroupIndex = newGroupIndex;

          const defaultVars = {
            noise: 1, light: 1, trafficLight: 1,
            tactile_pavement: 1, tree: 1,
            temperatureSummer: 1, temperatureWinter: 1
          };

          if (enabledVariables.length > 0) {
            weightedResPromise = fetchAccessibilityFromBackend({
              lat,
              lon,
              time: walkingTime,
              speed: walkingSpeed,
              variableSettings: layerValues,
              signal: controller.signal,
              mode: "weighted",
              queueGroupId,
              queueGroupSize,
            });
          }

          const defaultRes = await fetchAccessibilityFromBackend({
            lat,
            lon,
            time: walkingTime,
            speed: walkingSpeed,
            variableSettings: defaultVars,
            signal: controller.signal,
            mode: "default",
            queueGroupId,
            queueGroupSize,
          });
          if (!defaultRes || !defaultRes.polygon) {
            alert(t("err_api_failed_try_again"));
            setComputeAccessibility(false);
            setIsCalculating(false);
            return;
          }
          if (!isValidGeoJSON(defaultRes.polygon)) {
            alert(t("err_no_reachable_default"));
            setComputeAccessibility(false);
            setIsCalculating(false);
            return;
          }
          const defaultRoads = defaultRes.polygon.features;
          const defaultProcessing = buildBufferedAreaWithTiming(defaultRoads);
          const cleaned = defaultProcessing.cleaned;
          if (!isValidGeoJSON(cleaned)) {
            alert(t("err_no_reachable_default"));
            setComputeAccessibility(false);
            setIsCalculating(false);
            return;
          }
          defaultArea = defaultProcessing.areaHectares;
          logAccessibilityTiming(
            "default",
            defaultRes.requestTiming,
            {
              polygonFeatureCount: defaultRoads.length,
              polygonCoordinateCount: countCoordinates(defaultRoads),
              networkFeatureCount: defaultRes.network?.features?.length || 0,
              networkCoordinateCount: countCoordinates(defaultRes.network),
            }
          );

          setDefaultResultCache(prev => ({ ...prev, [key]: { network: defaultRes.network, hull: cleaned, area: defaultArea } }));
          setReachableRoadsData(prev => [...prev, defaultRes.network]);
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
        } else {
          currentGroupIndex = groupMapping[key];
          setDefaultGroupIndex(currentGroupIndex);
          defaultArea = defaultResultCache[key].area;
        }

        // --------- Step 2: Weighted Result (with comfort features) ---------
        if (enabledVariables.length > 0) {
          const weightedRes = weightedResPromise
            ? await weightedResPromise
            : await fetchAccessibilityFromBackend({
              lat,
              lon,
              time: walkingTime,
              speed: walkingSpeed,
              variableSettings: layerValues,
              signal: controller.signal,
              mode: "weighted",
              queueGroupId,
              queueGroupSize,
            });
          if (!weightedRes || !weightedRes.polygon) {
            alert(t("err_api_failed_try_again"));
            return;
          }
          if (!isValidGeoJSON(weightedRes.polygon)) {
            alert(t("err_no_reachable_weighted"));
            return;
          }
          const weightedRoads = weightedRes.polygon.features;
          const weightedProcessing = buildBufferedAreaWithTiming(weightedRoads);
          const cleaned2 = weightedProcessing.cleaned;
          if (!isValidGeoJSON(cleaned2)) {
            alert(t("err_no_reachable_weighted"));
            return;
          }
          let weightedArea = weightedProcessing.areaHectares;
          logAccessibilityTiming(
            "weighted",
            weightedRes.requestTiming,
            {
              polygonFeatureCount: weightedRoads.length,
              polygonCoordinateCount: countCoordinates(weightedRoads),
              networkFeatureCount: weightedRes.network?.features?.length || 0,
              networkCoordinateCount: countCoordinates(weightedRes.network),
            }
          );

          const ratio = (weightedArea / defaultArea).toFixed(2);
          const color = colorPool[resultMetadata.length % colorPool.length];

          setReachableRoadsData(prev => [...prev, weightedRes.network]);
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
        setCalcQueueStatus(null);
        setComputeAccessibility(false);
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
    calcElapsed,
    calcStage,
    calcQueueStatus,
    isValidGeoJSON,
  };
};
