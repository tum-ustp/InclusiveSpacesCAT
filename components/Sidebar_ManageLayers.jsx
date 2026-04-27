import React, { useState } from "react";
import sty from "./Sidebar.module.css";
import { useTranslation } from 'next-i18next'; 
import Tooltip from "./Sidebar_Tooltip";

function LayerCheckbox({ layerKey, label, checked, onToggle, t }) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const tooltipRef = React.useRef(null);

  const checkboxRef = React.useRef(null);

  return (
    <div className={sty["checkbox-container"]}>
      <div className={sty["checkbox-top-row"]}>
        <label className={sty["checkbox-label"]}>
          <input
            ref={checkboxRef} 
            type="checkbox"
            checked={checked}
            onChange={() => {
              onToggle();
              requestAnimationFrame(() => {
                checkboxRef.current?.focus();
              });
            }}
            className={sty.kbdFocus}
          />
          <span className={sty["sidebar-text"]}>{label}</span>
        </label>

        <button
          type="button"
          className={`${sty["info-icon"]} ${sty.kbdFocus}`}
          ref={tooltipRef}
          onClick={(e) => {
            e.stopPropagation();
            setShowTooltip((prev) => !prev);
          }}
          title={t("aria_layer_info_button", { layer: label })}
          aria-label={t("aria_layer_info_button", { layer: label })}
          aria-haspopup="dialog"
          aria-expanded={showTooltip}
          aria-controls={showTooltip ? `tip-layer-${layerKey}` : undefined}
        >
          <img src="/images/icon_info.png" alt="" aria-hidden="true" className={sty.infoIconImg} />
        </button>
      </div>
      <Tooltip
        show={showTooltip}
        type={`layer:${layerKey}`}
        anchorRef={tooltipRef}
        onClose={() => {
          setShowTooltip(false);
          tooltipRef.current?.focus();
        }}
        id={`tip-layer-${layerKey}`}
      />
    </div>
  );
}

function Category({ name, label, isOpen, onToggle, children, sty }) {
  const contentId = `category-content-${name}`;
  const headingId = `category-heading-${name}`;

  return (
    <div className={sty["faq-item"]}>
      <button
        type="button"
        className={`${sty["faq-question"]} ${sty.kbdFocus}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={isOpen ? contentId : undefined}
        id={headingId}
      >
        <span className={sty["sidebar-subtitle"]}>{label}</span>
        <span className={sty["faq-icon"]}>{isOpen ? "−" : "+"}</span>
      </button>

      {isOpen && (
        <div
          id={contentId}
          className={sty["faq-answer"]}
          role="group"
          aria-labelledby={headingId}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default function MapLayers({ selectedLayers, toggleLayer, availableLayers }) {
  const city = (typeof window !== "undefined" && (localStorage.getItem("selectedCity") || "hamburg")) || "hamburg"; 

  const [showInfo, setShowInfo] = useState(false);
  const infoIconRef = React.useRef();


  const { t } = useTranslation("common");
  const [openCategory, setOpenCategory] = useState(null);

  const toggleCategory = (category) => {
    setOpenCategory(openCategory === category ? null : category);
  };

  const groups = [
    { name: "env", label: t('env_category') },
    { name: "phy", label: t('phy_category') },
    { name: "psy", label: t('psy_category') }
  ];

  const renderCheckbox = (layer, label) => {
    if (!layer) return null;
    return (
      <LayerCheckbox
        key={layer.key}
        layerKey={layer.key}
        label={label}
        checked={selectedLayers.includes(layer.key)}
        onToggle={() => toggleLayer(layer.key)}
        t={t}
      />
    );
  };

  const findLayer = (key) =>
  availableLayers.find(l => l.key === key);

  return (
    <div className={sty["sidebar-section"]} aria-labelledby="map-layers-heading">
      <div className={sty["title-container"]}>
        <h2 id="map-layers-heading" className={sty["sidebar-section-title"]}>
          <img src="/images/help_data.png" alt={t("icon_data_info")} />
          <span>{t("map_layers")}</span>
        </h2>

        <button
          type="button"
          className={`${sty["info-icon"]} ${sty.kbdFocus}`}
          ref={infoIconRef}
          onClick={(e) => {
            e.stopPropagation();
            setShowInfo((prev) => !prev);
          }}
          title={t('tooltip_data_title')}
          aria-label={t('tooltip_data_title')}
          aria-haspopup="dialog"
          aria-expanded={showInfo}
          aria-controls={showInfo ? "tip-datainfo" : undefined}
        >
          <img src="/images/icon_info.png" alt="" aria-hidden="true" className={sty.infoIconImg} />
        </button>

        <Tooltip
          show={showInfo}
          type="dataInfo"
          anchorRef={infoIconRef}
          onClose={() => {
            setShowInfo(false);
            infoIconRef.current?.focus();
          }}
          id="tip-datainfo"
        />
      </div>

      <div className={sty["faq-container"]}>
        <Category
          name="env"
          label={t('env_category')}
          isOpen={openCategory === "env"}
          onToggle={() => toggleCategory("env")}
          sty={sty}
        >
          {/* {findLayer("noise_wms") && renderCheckbox(findLayer("noise_wms"), t('display_noise'))} */}
          {findLayer("temp_summer") && renderCheckbox(findLayer("temp_summer"), t('display_summer_heat'))}
          {findLayer("temp_winter") && renderCheckbox(findLayer("temp_winter"), t('display_winter_cold'))}
        </Category> 
        <Category
          name="phy"
          label={t('phy_category')}
          isOpen={openCategory === "phy"}
          onToggle={() => toggleCategory("phy")}
          sty={sty}
        >
          {findLayer("streetlight") && renderCheckbox(findLayer("streetlight"), t('display_light'))}
          {findLayer("trafic_light_wms") && renderCheckbox(findLayer("trafic_light_wms"), t('display_traffic'))}
          {findLayer("trafic_light") && renderCheckbox(findLayer("trafic_light"), t('display_traffic'))}
          {findLayer("tactile_guidance") && renderCheckbox(findLayer("tactile_guidance"), t('display_tactile'))}
          {findLayer("tree_wms") && renderCheckbox(findLayer("tree_wms"), t('display_tree'))}
          {findLayer("green_infrastructure_wms") && renderCheckbox(findLayer("green_infrastructure_wms"), t('display_green_inf'))}
          {findLayer("green_infrastructure") && renderCheckbox(findLayer("green_infrastructure"), t('display_green_inf'))}
          {findLayer("blue_infrastructure_wms") && renderCheckbox(findLayer("blue_infrastructure_wms"), t('display_blue_inf'))}
          {findLayer("transport_station_wms") && renderCheckbox(findLayer("transport_station_wms"), t('display_station'))}
          {findLayer("transport_station") && renderCheckbox(findLayer("transport_station"), t('display_station'))}
          {findLayer("sidewalk_narrow") && renderCheckbox(findLayer("sidewalk_narrow"), t('display_narrow'))}
          {findLayer("wc_disabled") && renderCheckbox(findLayer("wc_disabled"), t('display_wc'))}
          {findLayer("stair") && renderCheckbox(findLayer("stair"), t('display_stair'))}
          {findLayer("obstacle") && renderCheckbox(findLayer("obstacle"), t('display_obstacle'))}
          {findLayer("slope") && renderCheckbox(findLayer("slope"), t('display_slope'))}
          {findLayer("slope_penteli") && renderCheckbox(findLayer("slope_penteli"), t('display_slope'))}
          {findLayer("uneven_surfaces") && renderCheckbox(findLayer("uneven_surfaces"), t('display_uneven'))}
          {findLayer("poor_pavement") && renderCheckbox(findLayer("poor_pavement"), t('display_pavement'))}
          {findLayer("kerbs_high") && renderCheckbox(findLayer("kerbs_high"), t('display_kerb_high'))}
        </Category> 
        <Category 
          name="psy"
          label={t('psy_category')}
          isOpen={openCategory === "psy"}
          onToggle={() => toggleCategory("psy")}
          sty={sty}
        >
          {findLayer("facility_hh") && renderCheckbox(findLayer("facility_hh"), t('display_facility'))}
          {findLayer("facilities") && renderCheckbox(findLayer("facilities"), t('display_facility'))}
          {findLayer("pedestrian_flow_wms") && renderCheckbox(findLayer("pedestrian_flow_wms"), t('display_pedestrian_flow'))}
          {findLayer("pedestrian_flow") && renderCheckbox(findLayer("pedestrian_flow"), t('display_pedestrian_flow'))}
        </Category>
      </div>
    </div>
  );

}
 
