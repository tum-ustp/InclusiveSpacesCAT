import Legend from "../Legend";
import { getStyle, isWmsLayer, layerGroupMap, wmsLayerComponents } from "../LayerStyleManager";

const ReachabilityLayers = ({
  MapModule,
  cityBoundaries,
  selectedLayers,
  layerTypeMap,
  selectedCity,
  geoJsonData,
  resultMetadata,
  reachableRoadsData,
  reachableHullData,
  highlightedIndex,
  isValidGeoJSON,
  onFocusArea,
  t,
}) => {
  const { GeoJSON, Tooltip } = MapModule;
  const visibleGeoJsonLayerKeys = new Set(
    selectedLayers.flatMap((layer) => layerGroupMap[layer] || [layer])
  );

  return (
    <>
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
        return WmsComponent ? <WmsComponent key={layer} city={selectedCity} /> : null;
      })}

      {/* Render Geojson Layers based on selectedLayers*/}
      {Object.entries(geoJsonData).map(([layer, data]) => {
        if (!visibleGeoJsonLayerKeys.has(layer)) {
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
        onFocusArea={onFocusArea}
      />

      {/* Render reachable roads and hulls */}
      {/* {reachableRoadsData.map((roads, i) =>
        isValidGeoJSON(roads) ? (
          <GeoJSON
            key={`roads-${i}`}
            data={roads}
            style={{
              color: resultMetadata[i]?.color || '#413190',
              weight: 0.5,
              opacity: 0.8
            }}
          />
        ) : null
      )} */}
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
    </>
  );
};

export default ReachabilityLayers;
