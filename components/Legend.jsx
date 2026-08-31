import React, { useState, useEffect, useRef } from "react";
import styles from "./Legend.module.css";
import { useTranslation } from 'next-i18next';


const Legend = ({ resultMetadata, onFocusArea }) => {
  const { t } = useTranslation("common");
  const [isExpanded, setIsExpanded] = useState(true);
  const bodyRef = useRef(null);

  const [openComfort, setOpenComfort] = React.useState({});
  const [openPoi, setOpenPoi] = React.useState({});

  //temperorial, only show amenities for hamburg (no data for penteli)
  const city =
    (typeof window !== "undefined" &&
      (localStorage.getItem("selectedCity") || "hamburg")) ||
    "hamburg";
  const showAmenities = city === "hamburg" || city === "penteli";

  const variableDisplayNames = {
    noise: t('checkbox_noise'),
    light: t('checkbox_light'),
    tree: t('checkbox_tree'),
    trafficLight: t('checkbox_traffic'),
    tactile_pavement: t('checkbox_tactile'),
    temperatureSummer: t('checkbox_temp_summer'),
    temperatureWinter: t('checkbox_temp_winter'),
    blueinf: t('checkbox_blue'),
    greeninf: t('checkbox_green'),
    station: t('checkbox_station'),
    wcDisabled: t('checkbox_wc'),
    narrowRoads: t('checkbox_narrow'),
    stair: t('checkbox_stair'), 
    obstacle: t('checkbox_obstacle'),
    slope: t('checkbox_slope'),
    unevenSurface: t('checkbox_uneven'),
    poorPavement: t('checkbox_poor'),
    kerbsHigh: t('checkbox_kerb'),
    facility: t('checkbox_facility'),
    pedestrianFlow: t('checkbox_crowd'),
  };

  const weightLevels = [0.1, 0.5, 0.7, 0.9];
  const weightLabels = [
    "❌",
    "😩",
    "☹️",
    "😐"
  ];
 
  const poiCategoryNames = {
    poi_hh_gastronomy: t("leg_poi_gastronomy"),
    poi_hh_health: t("leg_poi_health"),
    poi_hh_kita_schule: t("leg_poi_kita_schule"),
    poi_hh_park_spiel: t("leg_poi_park_spiel"),
    poi_hh_supermarket: t("leg_poi_supermarket"),
    poi_hh_uni_fh: t("leg_poi_uni_fh"),

    poi_pt_education: t("leg_poi_education"),
    poi_pt_gastronomy: t("leg_poi_gastronomy"),
    poi_pt_haltstelle: t("leg_poi_haltstelle"),
    poi_pt_health: t("leg_poi_health"),
    poi_pt_library: t("leg_poi_library"),
    poi_pt_music_exhibition: t("leg_poi_music_exhibition"),
    poi_pt_other: t("leg_poi_other"),
    poi_pt_religious: t("leg_poi_religious")
  };

  // prevent scroll on wheel event when legend is expanded
  useEffect(() => {
    const container = bodyRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.stopPropagation(); 
    };

    container.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [isExpanded]);

  const getWeightLabel = (value) => {
    const index = weightLevels.indexOf(Number(value));
    return index !== -1 ? weightLabels[index] : value;
  };
  const legendBodyId = "legend-body";

  return (
    <section
      id="legend"
      tabIndex={-1}
      className={styles["legend-container"]}
      aria-labelledby="legend-heading"
    >
      {/* Dedicated area for screen readers: Number of new results to be displayed */} 
      <div aria-live="polite" className={styles["srOnly"]} role="status">
        {resultMetadata.length > 0 &&
          t("sr_results_loaded", { count: resultMetadata.length })}
      </div>

      <div className={styles["legend-header"]}>
        <button
          id="legend-heading"
          className={styles["legend-header-button"]}
          type="button"
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? legendBodyId : undefined}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className={styles["legend-header-title"]}>
            {t("leg_catchment_result")}
          </span>
          <span
            className={styles["legend-header-toggle"]}
            aria-hidden="true"
          >
            {isExpanded ? "▼" : "▲"}
          </span>
        </button>
      </div>

      {isExpanded && (
        <div
          className={styles["legend-body"]}
          id={legendBodyId}
          ref={bodyRef}
        >
          {resultMetadata.map((entry, index) => {
            const color = entry.color;
            const features = entry.layers;
            const values = entry.values;

            const comfortId = `comfort-${index}`;
            const poiId = `poi-${index}`;

            const sectionHeadingId = `legend-section-${index}-heading`;

            return (
              <div
                key={index}
                className={styles["legend-section"]}
                role="region"
                aria-labelledby={sectionHeadingId}
              >
                <div className={styles["legend-title"]}>
                  <button
                    type="button"
                    id={sectionHeadingId}
                    className={styles["legend-title-button"]}
                    onClick={() => {
                      if (typeof onFocusArea === "function") {
                        onFocusArea(index);
                      }
                    }}
                  >
                    <span
                      className={styles["legend-color-box"]}
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                      role="presentation"
                    />
                    {entry.isDefault ? (
                      <span>
                        <span>{t("legend_base_area")} {entry.groupIndex}</span>
                        <span style={{ fontSize: "1.0em", color: "#666" }}>
                          {t("legend_without_factors")}
                        </span>
                      </span>
                    ) : (
                      `${t("legend_adjusted_area")} ${entry.groupIndex}.${entry.subIndex ?? ""}`
                    )}
                  </button>
                </div>

                <div>{t('leg_time_label')} {entry.time} {t('minutes')}</div>
                <div>{t('leg_speed_label')} {entry.speed} km/h</div>
                <div>{t('leg_area_label')} {entry.area} ha</div>
                {!entry.isDefault && <div>{t('leg_comfort_ratio')} {entry.weightedRatio}</div>}
 
                {/* Comfort Feature Weight Categories */}
                {(() => {
                  const isComfortOpen = !!openComfort[index];

                  return (
                    <>
                      <button
                        type="button"
                        className={styles["toggle-button"]}
                        aria-expanded={isComfortOpen}
                        aria-controls={comfortId}
                        onClick={() =>
                          setOpenComfort((prev) => ({ ...prev, [index]: !prev[index] }))
                        }
                      >
                        {(isComfortOpen ? "▼ " : "► ") + t("leg_comfort_weight_title")}
                      </button>

                      <div id={comfortId} hidden={!isComfortOpen} style={{ marginLeft: "8px" }}>
                        {features.length > 0 ? (
                          <ul className={styles["legend-list"]}>
                            {features.map((layer) => (
                              <li key={layer}>
                                {variableDisplayNames[layer] || layer}:{" "}
                                {getWeightLabel(values[layer]) ?? "N/A"}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className={styles["legend-none"]}>{t("leg_none")}</div>
                        )}
                      </div>
                    </>
                  );
                })()}

                {/* Amenities / POI Count - Hamburg only */}
                {showAmenities &&
                  (() => {
                    const poiCount = Number(entry.poiCount ?? 0);
                    const hasGroups =
                      entry.poiGroupCounts && Object.keys(entry.poiGroupCounts).length > 0;

                    return (
                      <div style={{ marginTop: 0 }}>
                        <button
                          className={styles["toggle-button"]}
                          style={{ marginBottom: 2 }}
                          aria-expanded={!!openPoi[index]}
                          aria-controls={poiId}
                          onClick={() =>
                            setOpenPoi((prev) => ({ ...prev, [index]: !prev[index] }))
                          }
                        >
                          {(openPoi[index] ? "▼ " : "► ") + t("leg_poi_count") + `: ${poiCount}`}
                        </button>

                        <div id={poiId} hidden={!openPoi[index]} style={{ marginLeft: 8 }}>
                          {hasGroups ? (
                            Object.entries(entry.poiGroupCounts).map(([cat, count]) => (
                              <div key={cat}>
                                • {poiCategoryNames[cat] || cat}: {count}
                              </div>
                            ))
                          ) : (
                            <div className={styles["legend-none"]}>{t("leg_none")}</div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

              </div>
            );
          })}
        </div>
      )}
    </section>
  );

};

export default Legend;
