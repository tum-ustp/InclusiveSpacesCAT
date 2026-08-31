import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css"; 
import proj4 from "proj4"; 
import sty from './MapComponent.module.css'; 
import {isWmsLayer, buildLayerTypeMap, layerGroupMap} from "./LayerStyleManager";
import { useTranslation } from "next-i18next";
import SurveyInvite from "./map/surveyInvite";
import ReachabilityLayers from "./map/ReachabilityLayers";
import { useMapInteractions } from "./map/useMapInteractions";
import { useCatchmentArea } from "./map/useCatchmentArea";

// Dynamic import for react-leaflet
const MapLib = dynamic(
  () => import("react-leaflet"),
  { ssr: false }
); 

proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");
proj4.defs("EPSG:25832", "+proj=utm +zone=32 +ellps=WGS84 +datum=WGS84 +units=m +no_defs");

const CARTO_BASEMAP_KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY;
const CARTO_BASEMAP_URL = CARTO_BASEMAP_KEY
  ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_BASEMAP_KEY}`
  : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

const MapInstanceReporter = ({ useMap, onMapReady }) => {
  const map = useMap();

  useEffect(() => {
    onMapReady?.(map);
    return () => onMapReady?.(null);
  }, [map, onMapReady]);

  return null;
};
 
const MapComponent = ({ 
  cityCenter = [53.5503, 9.9920],
  selectedCity: selectedCityProp,
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
  onScreenshotReady,
  onScreenshotAvailabilityChange,
  onGeoJsonDownloadReady,
  onGeoJsonDownloadAvailabilityChange,
  onSurveyOpenReady,
  onSurveyAvailabilityChange,
}) => {
  const [MapModule, setMapModule] = useState(null);
  const [customMarkerIcon, setCustomMarkerIcon] = useState(null);
  const [geoJsonData, setGeoJsonData] = useState({}); 
  const [cityBoundaries, setCityBoundaries] = useState({});
  const mapInstanceRef = useRef(null);
  const screenshotDataRef = useRef({
    selectedCity: null,
    reachableHullData: [],
    resultMetadata: [],
    highlightedIndex: null,
    startPoint: null,
    hasDataInformationLayers: false,
  });
  const geoJsonArchiveDataRef = useRef({
    selectedCity: null,
    visibleGeoJsonLayers: {},
    reachableHullData: [],
    reachableRoadsData: [],
    resultMetadata: [],
    cityBoundaries: {},
  });

  const { t } = useTranslation("common");

  const getSelectedCity = () =>
    (typeof window !== "undefined" &&
      (localStorage.getItem("selectedCity") || "hamburg")) ||
    "hamburg";
  const [storedSelectedCity] = useState(getSelectedCity);
  const selectedCity = selectedCityProp || storedSelectedCity;

  const mapRegionLabel = t("aria_map_region");

  const layerTypeMap = useMemo(
    () => buildLayerTypeMap(availableLayers),
    [availableLayers]
  );
  const availableLayerKeys = useMemo(
    () => new Set((availableLayers || []).map((l) => l.key)),
    [availableLayers]
  );

  const {
    reachableRoadsData,
    reachableHullData,
    isCalculating,
    resultMetadata,
    surveyInviteTrigger,
    calcElapsed,
    calcStage,
    isValidGeoJSON,
  } = useCatchmentArea({
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
  });

  useEffect(() => {
    onScreenshotAvailabilityChange?.(reachableHullData.length > 0);
  }, [reachableHullData.length, onScreenshotAvailabilityChange]);

  const visibleGeoJsonLayers = useMemo(() => {
    const visibleLayers = {};
    const filteredSelectedLayers = selectedLayers.filter((layer) =>
      availableLayerKeys.has(layer)
    );
    const expandedLayers = filteredSelectedLayers.flatMap((layer) =>
      layerGroupMap[layer] || [layer]
    );

    for (const layer of expandedLayers) {
      if (isWmsLayer(layer, layerTypeMap)) continue;
      if (geoJsonData[layer]) {
        visibleLayers[layer] = geoJsonData[layer];
      }
    }

    return visibleLayers;
  }, [availableLayerKeys, geoJsonData, layerTypeMap, selectedLayers]);

  screenshotDataRef.current = {
    selectedCity,
    reachableHullData,
    resultMetadata,
    highlightedIndex,
    startPoint: startPoints.at(-1) || null,
    hasDataInformationLayers: selectedLayers.length > 0,
  };

  geoJsonArchiveDataRef.current = {
    selectedCity,
    visibleGeoJsonLayers,
    reachableHullData,
    reachableRoadsData,
    resultMetadata,
    cityBoundaries,
  };

  useEffect(() => {
    const hasVisibleGeoJsonLayers = Object.keys(visibleGeoJsonLayers).length > 0;
    const hasCalculationResults = reachableHullData.length > 0 || reachableRoadsData.length > 0;
    const hasCityBoundary = Boolean(cityBoundaries[selectedCity]);
    onGeoJsonDownloadAvailabilityChange?.(
      hasVisibleGeoJsonLayers || hasCalculationResults || hasCityBoundary
    );
  }, [
    cityBoundaries,
    onGeoJsonDownloadAvailabilityChange,
    reachableHullData.length,
    reachableRoadsData.length,
    selectedCity,
    visibleGeoJsonLayers,
  ]);

  const handleMapReady = useCallback((map) => {
    mapInstanceRef.current = map;
  }, []);

  const handleScreenshotDownload = useCallback(async () => {
    const mapElement = document.getElementById("map-region") || document.querySelector(`.${sty.leafletMap}`);
    const { exportMapScreenshot } = await import("./map/exportMapScreenshot");
    const {
      selectedCity: screenshotCity,
      reachableHullData: screenshotHullData,
      resultMetadata: screenshotResultMetadata,
      highlightedIndex: screenshotHighlightedIndex,
      startPoint,
      hasDataInformationLayers,
    } = screenshotDataRef.current;

    if (hasDataInformationLayers) {
      window.alert(t("alert_screenshot_limited"));
    }

    await exportMapScreenshot({
      mapElement,
      map: mapInstanceRef.current,
      city: screenshotCity,
      reachableHullData: screenshotHullData,
      resultMetadata: screenshotResultMetadata,
      highlightedIndex: screenshotHighlightedIndex,
      startPoint,
    });
  }, [t]);

  useEffect(() => {
    onScreenshotReady?.(handleScreenshotDownload);
    return () => onScreenshotReady?.(null);
  }, [handleScreenshotDownload, onScreenshotReady]);

  const handleGeoJsonArchiveDownload = useCallback(async () => {
    const { exportGeoJsonArchive } = await import("./map/exportGeoJsonArchive");
    const {
      selectedCity: exportCity,
      visibleGeoJsonLayers: exportVisibleGeoJsonLayers,
      reachableHullData: exportReachableHullData,
      reachableRoadsData: exportReachableRoadsData,
      resultMetadata: exportResultMetadata,
      cityBoundaries: exportCityBoundaries,
    } = geoJsonArchiveDataRef.current;

    exportGeoJsonArchive({
      city: exportCity,
      visibleGeoJsonLayers: exportVisibleGeoJsonLayers,
      reachableHullData: exportReachableHullData,
      reachableRoadsData: exportReachableRoadsData,
      resultMetadata: exportResultMetadata,
      cityBoundaries: exportCityBoundaries,
    });
  }, []);

  useEffect(() => {
    onGeoJsonDownloadReady?.(handleGeoJsonArchiveDownload);
    return () => onGeoJsonDownloadReady?.(null);
  }, [handleGeoJsonArchiveDownload, onGeoJsonDownloadReady]);

  const {
    mousePosition,
    handleFocusArea,
    MapClickHandler,
    AutoZoomToStart,
    MakeMapKeyboardAccessible,
  } = useMapInteractions({
    MapModule,
    selectingStart,
    setSelectingStart,
    startPoints,
    setStartPoints,
    isSearchZoom,
    setIsSearchZoom,
    reachableHullData,
    setHighlightedIndex,
    t,
  });

  // load city boundary
  useEffect(() => {
    Promise.all([
      fetch(`/data/penteli/penteli_boundary.geojson`).then(res => res.json()),
      fetch(`/data/hamburg/hamburg_boundary.geojson`).then(res => res.json())
    ]).then(([pt, hh]) => {
      setCityBoundaries({ hamburg: hh, penteli: pt });
    });
  }, []);

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

  // Reset the state when resetTrigger changes 
  useEffect(() => {
    if (resetTrigger) {
      setStartPoints([]); 
      onResetHandled && onResetHandled(); 
    }
  }, [resetTrigger, onResetHandled]);  

  // Load GeoJSON data for the selected layers (sidebar map layers)
  useEffect(() => {
    let cancelled = false;

    const loadGeoJsonData = async () => {
      const filteredSelectedLayers = selectedLayers.filter((layer) =>
        availableLayerKeys.has(layer)
      );

      const expandedLayers = filteredSelectedLayers.flatMap(layer =>
        layerGroupMap[layer] || [layer]
      );

      const expandedLayerSet = new Set(expandedLayers);

      setGeoJsonData((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(([key]) =>
            key.startsWith("poi_") || expandedLayerSet.has(key)
          )
        )
      );

      const loadableLayers = expandedLayers.filter(
        (layer) => !isWmsLayer(layer, layerTypeMap)
      );

      const layerRequests = new Map(
        loadableLayers.map((layer) => {
          const filePath = layer.startsWith("poi_")
            ? `/data/POI/${layer}.geojson`
            : `/data/${selectedCity}/${layer}.geojson`;
          const request = fetch(filePath)
            .then((res) => {
              if (!res.ok) {
                throw new Error(`Failed to load ${filePath}: ${res.status}`);
              }
              return res.json();
            })
            .then((data) => ({ data }))
            .catch((error) => ({ error }));

          return [layer, request];
        })
      );

      for (const layer of loadableLayers) {
        try {
          const result = await layerRequests.get(layer);
          if (cancelled) return;
          if (result.error) {
            throw result.error;
          }
          setGeoJsonData((prev) => ({
            ...prev,
            [layer]: result.data
          }));
        } catch (err) {
          if (cancelled) return;
          console.error("Failed to load:", layer, err);
        }
      }
    };

    loadGeoJsonData();
    return () => {
      cancelled = true;
    };
   }, [selectedLayers, selectedCity, layerTypeMap, availableLayerKeys]);
  
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
  const { MapContainer, TileLayer, Marker, Popup, Pane } = MapModule;

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

      <SurveyInvite
        city={selectedCity}
        trigger={surveyInviteTrigger}
        onSurveyOpenReady={onSurveyOpenReady}
        onSurveyAvailabilityChange={onSurveyAvailabilityChange}
      />

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
        <MapInstanceReporter useMap={MapModule.useMap} onMapReady={handleMapReady} />
        <AutoZoomToStart
          startPoints={startPoints}
          isSearchZoom={isSearchZoom}
          setIsSearchZoom={setIsSearchZoom}
        />
        <MakeMapKeyboardAccessible />
        <TileLayer
          crossOrigin="anonymous"
          //different base map

          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url={CARTO_BASEMAP_URL}

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

        <ReachabilityLayers
          MapModule={MapModule}
          cityBoundaries={cityBoundaries}
          selectedLayers={selectedLayers}
          layerTypeMap={layerTypeMap}
          selectedCity={selectedCity}
          geoJsonData={geoJsonData}
          resultMetadata={resultMetadata}
          reachableRoadsData={reachableRoadsData}
          reachableHullData={reachableHullData}
          highlightedIndex={highlightedIndex}
          isValidGeoJSON={isValidGeoJSON}
          onFocusArea={handleFocusArea}
          t={t}
        />
      </MapContainer>
    </section>
  );
};

export default MapComponent;
