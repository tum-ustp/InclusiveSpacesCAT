import React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import sty from "./Sidebar.module.css";

export default function Sidebar_Tooltip({ show, type, city, anchorRef, onClose, id }) {
  const { t } = useTranslation("common");
  const [pos, setPos] = React.useState(null);
  const [positioned, setPositioned] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // readable name for dialog, for aria-label
  const dialogLabel = React.useMemo(() => {
    if (!type) {
      return t("tooltip_default_title");
    }

    if (type === "dataInfo") {
      return t("tooltip_data_title");
    }

    if (type === "walkingSpeed") {
      return t("tooltip_walking_speed_title");
    }

    if (type === "variable") {
      return t("tooltip_comfort_features_title");
    }

    const featureLabelKey = {
      noise: "checkbox_noise",
      light: "checkbox_light",
      tree: "checkbox_tree",
      trafficLight: "checkbox_traffic",
      tactile_pavement: "checkbox_tactile",
      temperatureSummer: "checkbox_temp_summer",
      temperatureWinter: "checkbox_temp_winter",
      stair: "checkbox_stair",
      obstacle: "checkbox_obstacle",
      unevenSurface: "checkbox_uneven",
      poorPavement: "checkbox_poor",
      kerbsHigh: "checkbox_kerb",
      facility: "checkbox_facility",
      pedestrianFlow: "checkbox_crowd",
      greeninf: "checkbox_green",
      blueinf: "checkbox_blue",
      station: "checkbox_station",
      narrowRoads: "checkbox_narrow",
      wcDisabled: "checkbox_wc",
      slope: "checkbox_slope",
      slope_penteli: "checkbox_slope",
    };

    if (featureLabelKey[type]) {
      return t(featureLabelKey[type], { defaultValue: type });
    }

    // Map layers：layer:noise, layer:light...
    if (type.startsWith("layer:")) {
      const key = type.slice(6);
      return t(`tooltip_layer.${key}.title`, { defaultValue: key });
    }

    return t("tooltip_default_title");
  }, [type, t]);

  React.useEffect(() => {
    if (!show || !mounted) {
      setPositioned(false);
      return;
    }

    const anchor = anchorRef?.current;
    if (!anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    setPos({
      top: anchorRect.bottom + 8,
      left: anchorRect.left,
    });

    // calculate size for tolltip popup window
    const rafId = requestAnimationFrame(() => {
      const tooltipEl = containerRef.current;
      if (!tooltipEl) return;

      const tipRect = tooltipEl.getBoundingClientRect();
      const margin = 8;

      let top = anchorRect.bottom + 8; // default
      let left = anchorRect.left;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // when window overflow: horizontal
      if (left + tipRect.width > viewportWidth - margin) {
        left = viewportWidth - margin - tipRect.width;
      }
      if (left < margin) {
        left = margin;
      }
      // vertical
      if (top + tipRect.height > viewportHeight - margin) {
        top = anchorRect.top - tipRect.height - 8;
        if (top < margin) {
          top = margin;
        }
      }
      setPos({ top, left });
      setPositioned(true);
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [show, mounted, anchorRef]);


  // close popup window
  React.useEffect(() => {
    if (!show) return;

    const node = containerRef.current;
    node?.focus?.();

    const onDocClick = (e) => {
      const tooltipEl = containerRef.current;
      const anchor = anchorRef?.current;
      if (!tooltipEl) return;

      const clickInsideTooltip = tooltipEl.contains(e.target);
      const clickOnAnchor = anchor && anchor.contains(e.target);

      if (!clickInsideTooltip && !clickOnAnchor) {
        onClose?.();
        anchor?.focus?.();
      }
    };

    const onEsc = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        anchorRef?.current?.focus?.();
      }
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [show, onClose, anchorRef]);

  if (!show || !mounted) {
    return null;
  }

  const tooltipStyle = positioned
    ? { top: pos.top, left: pos.left }
    : { top: 0, left: 0, visibility: "hidden" };

  const tooltipNode = (
    <div
      ref={containerRef}
      id={id}
      role="dialog"
      aria-modal="false"
      aria-label={dialogLabel}
      tabIndex={-1}
      className={sty["tooltip-container"]}
      style={tooltipStyle}
    >
      {contentFor(type, t, city)}
    </div>
  );

  return createPortal(tooltipNode, document.body);

}

function contentFor(type, t, city) {
  const featureTooltip = (key) => (
    <div className={sty["tooltip-content"]}>
      <p className={sty["tooltip-text"]}>{t(key)}</p>
    </div>
  );

  if (!type) {
    return (
      <div className={sty["tooltip-content"]}>
        <p className={sty["tooltip-text"]}>
          {t("tooltip_default", { defaultValue: "No details." })}
        </p>
      </div>
    );
  }

  if (type.startsWith("layer:")) {
    const tp = type;
    const key = tp.slice(6);
    const tooltipKey =
      city === "munich" && key === "trafic_light_wms"
        ? "munich_trafic_light_wms"
        : key;
    const title = t(`tooltip_layer.${tooltipKey}.title`, { defaultValue: key });
    const desc = t(`tooltip_layer.${tooltipKey}.desc`, {
      defaultValue: `Information about ${key} layer.`,
    });
    const source = t(`tooltip_layer.${tooltipKey}.source`, {
      defaultValue: t("tooltip_data_source_generic", {
        defaultValue: "City / project data",
      }),
    });

    return (
      <div className={sty["tooltip-content"]}>
        <div className={sty["tooltip-title"]}>{title}</div>
        <div>
          <b>
            {t("tooltip_data_source_label", { defaultValue: "Source:" })}
          </b>{" "}
          {source}
        </div>
        <div className={sty["tooltip-description"]}>{desc}</div>
      </div>
    );
  }

  // Data info tooltip
  if (type === "dataInfo") {
    const isMunich = city === "munich";
    const title = isMunich
      ? t("tooltip_data_info_munich_title", {
          defaultValue: t("tooltip_data_title", { defaultValue: "Data information" }),
        })
      : t("tooltip_data_title", { defaultValue: "Data information" });
    const source = isMunich
      ? t("tooltip_data_info_munich_source", {
          defaultValue: t("tooltip_data_source_generic", {
            defaultValue: "City / project data",
          }),
        })
      : null;
    const desc = isMunich
      ? t("tooltip_data_info_munich_desc", {
          defaultValue:
            "The dataset provides locations of signal-controlled intersections in Munich. For the accessibility catchment calculation, a 20 m buffer around each traffic-light point was used to identify nearby street segments. These segments were then marked as affected by the traffic-light factor.",
        })
      : t("tooltip_data_desc", {
          defaultValue:
            "This tool uses street network and environmental data to estimate accessible areas for different walking comfort profiles.",
        });

    return (
      <div className={sty["tooltip-content"]}>
        <div className={sty["tooltip-title"]}>
          {title}
        </div>
        {source && (
          <div>
            <b>
              {t("tooltip_data_source_label", { defaultValue: "Source:" })}
            </b>{" "}
            {source}
          </div>
        )}
        <div className={sty["tooltip-description"]}>
          {desc}
        </div>
      </div>
    );
  }

  // Walking speed tooltip
  if (type === "walkingSpeed") {
    return (
      <div className={sty["tooltip-content"]}>
        <p className={sty["tooltip-text"]}>
          {t("tooltip_walking_speed_intro")}
        </p>
        <ul className={sty["tooltip-list"]}>
          <li>{t("tooltip_walking_speed_stroll")}</li>
          <li>{t("tooltip_walking_speed_average")}</li>
          <li>{t("tooltip_walking_speed_brisk")}</li>
        </ul>
      </div>
    );
  }

  // tooltip for features, show features tooltip according to type
  if (type === "variable") {
    return (
      <div className={sty["tooltip-content"]}>
        <p className={sty["tooltip-text"]}>
          {t("tooltip_variable_title")}
        </p>
      </div>
    );
  }
  if (type === "noise") return featureTooltip("tooltip_noise");
  if (type === "light") return featureTooltip("tooltip_light");
  if (type === "tree") return featureTooltip("tooltip_tree");
  if (type === "trafficLight") return featureTooltip("tooltip_traffic");
  if (type === "tactile_pavement") return featureTooltip("tooltip_tactile");
  if (type === "temperatureSummer") return featureTooltip("tooltip_summer");
  if (type === "temperatureWinter") return featureTooltip("tooltip_winter");
  if (type === "stair") return featureTooltip("tooltip_stair");
  if (type === "obstacle") return featureTooltip("tooltip_obstacle");
  if (type === "unevenSurface") return featureTooltip("tooltip_uneven");
  if (type === "poorPavement") return featureTooltip("tooltip_poor");
  if (type === "kerbsHigh") return featureTooltip("tooltip_kerb");
  if (type === "facility") return featureTooltip("tooltip_facility");
  if (type === "pedestrianFlow") return featureTooltip("tooltip_crowd");
  if (type === "greeninf") return featureTooltip("tooltip_green");
  if (type === "blueinf") return featureTooltip("tooltip_blue");
  if (type === "station") return featureTooltip("tooltip_station");
  if (type === "narrowRoads") return featureTooltip("tooltip_narrow");
  if (type === "wcDisabled") return featureTooltip("tooltip_wc");
  if (type === "slope") return featureTooltip("tooltip_slope");
  if (type === "slope_penteli") return featureTooltip("tooltip_slope");
  if (type === "walkingSpeed")
    return (
      <div className={sty["tooltip-content"]}>
        <p className={sty["tooltip-text"]}>
          {t('tooltip_walking_speed_intro')}
        </p>
        <ul className={sty["tooltip-list"]}>
          <li>{t('tooltip_walking_speed_stroll')}</li>
          <li>{t('tooltip_walking_speed_average')}</li>
          <li>{t('tooltip_walking_speed_brisk')}</li>
        </ul>
      </div>
    ); 

  // fallback
  return (
    <div className={sty["tooltip-content"]}>
      <p className={sty["tooltip-text"]}>
        {t("tooltip_default", { defaultValue: "No details." })}
      </p>
    </div>
  );
}
