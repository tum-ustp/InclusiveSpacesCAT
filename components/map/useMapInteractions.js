import { useEffect, useState } from "react";

export const useMapInteractions = ({
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
}) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

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

  const handleFocusArea = (idx) => {
    if (!reachableHullData[idx]) return;
    const L = require("leaflet");
    const map = document.querySelector(".leaflet-container")?._leaflet_map;
    if (!map) return;
    map.fitBounds(L.geoJSON(reachableHullData[idx]).getBounds(), { padding: [40, 40] });
    setHighlightedIndex(idx);
    console.log("setHighlightedIndex to", idx);
  };

  const MapClickHandler = () => {
    const { useMapEvents } = MapModule;

    useMapEvents({
      click: (e) => {
        if (selectingStart) {
          const [lon, lat] = [e.latlng.lng, e.latlng.lat];
          console.log("Selected starting pointпјљ", [lon, lat]);
          setStartPoints(prev => [...prev, [lon, lat]]);
          setSelectingStart(false);
        }
      }

    });
    return null;
  };

  function AutoZoomToStart({ startPoints, isSearchZoom, setIsSearchZoom }) {
    const { useMap } = MapModule;
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
    const { useMap } = MapModule;
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

  return {
    mousePosition,
    handleFocusArea,
    MapClickHandler,
    AutoZoomToStart,
    MakeMapKeyboardAccessible,
  };
};
