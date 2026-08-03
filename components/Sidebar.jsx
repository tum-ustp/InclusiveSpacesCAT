import React from "react";
import projectcss from "./plasmic/saa_s_website/PlasmicUser.module.css";
import sty from "./Sidebar.module.css";
import classNames from "classnames";
import ArrowSvgIcon from "./plasmic/saa_s_website/icons/PlasmicIcon__ArrowSvg";
import AccessibilityControls from "./Sidebar_AccessibilityControls";
import VariableControls from "./Sidebar_VariableControls";
import MapLayers from "./Sidebar_ManageLayers";
import { useTranslation } from "next-i18next";

export default function Sidebar({
    sidebarOpen,
    setSidebarOpen,
    selectedLayers,
    enabledVariables={enabledVariables},
    toggleVariable={toggleVariable},
    toggleLayer,
    layerValues,
    availableLayers,
    handleInputChange,
    walkingTime,
    setWalkingTime,
    walkingSpeed,
    setWalkingSpeed,
    setSelectingStart,
    selectingStart,
    startPoints,
    setStartPoints,
    setComputeAccessibility,
    handleResetResults,
    handleClearResult,
    handleClearVariables,
    openCategory,
    toggleCategory,
    showInfo,
    setShowInfo,
    isSearchZoom,
    setIsSearchZoom,
    city,
    cityBoundaries,
    onDownloadScreenshot,
    canDownloadScreenshot,
    isDownloadingScreenshot,
  }) {
    const { t } = useTranslation("common");
    const [srStatus, setSrStatus] = React.useState("");
    return (
        <div
            id="sidebar"
            tabIndex={-1}
            className={classNames(
            projectcss.all,
            sty.sideBarBox,
            {
                [sty.sideBarBoxsidebarOpen]: sidebarOpen,
                [sty.sideBarBoxsidebarClose]: !sidebarOpen
            }
            )}
        >      
        <p className={sty.srOnly} role="status" aria-live="polite" aria-atomic="true">
          {srStatus}
        </p>
        <div className={sty.arrowToggleContainer}>
          <button
            className={sty.sidebarToggleButton}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? t("aria_collapse_sidebar") : t("aria_expand_sidebar")}
            aria-expanded={sidebarOpen}
          >
            <ArrowSvgIcon className={sty.sidebarToggleArrow} aria-hidden="true" />
          </button>
        </div>
  
        <div className={`${sty.freeBox} ${sidebarOpen ? sty.freeBoxsidebarOpen : ""}`}>
          <AccessibilityControls
            city={city}
            cityBoundaries={cityBoundaries}
            walkingTime={walkingTime}
            setWalkingTime={setWalkingTime}
            walkingSpeed={walkingSpeed}
            setWalkingSpeed={setWalkingSpeed}
            setSelectingStart={setSelectingStart}
            selectingStart={selectingStart}
            startPoints={startPoints}
            setStartPoints={setStartPoints} 
            handleResetResults={handleResetResults}
            handleClearResult={handleClearResult}
            isSearchZoom = {isSearchZoom}
            setIsSearchZoom={setIsSearchZoom}
          />
  
          <VariableControls
            city={city}
            enabledVariables={enabledVariables} 
            toggleVariable={toggleVariable}  
            selectedLayers={selectedLayers}
            toggleLayer={toggleLayer}
            layerValues={layerValues}
            handleInputChange={handleInputChange}
            openCategory={openCategory}
            toggleCategory={toggleCategory}
            showInfo={showInfo}
            setShowInfo={setShowInfo}
            startPoints={startPoints}
            setComputeAccessibility={setComputeAccessibility}
            walkingTime={walkingTime}
            walkingSpeed={walkingSpeed}
            handleClearResult={handleClearResult}
            handleClearVariables={handleClearVariables}
          />
  
          <MapLayers
            selectedLayers={selectedLayers}
            toggleLayer={toggleLayer}
            availableLayers={availableLayers}
            isSearchZoom={isSearchZoom}
            setIsSearchZoom={setIsSearchZoom}
          />

          <button
            type="button"
            className={`${sty["setup-button"]} ${sty.kbdFocus}`}
            disabled={!canDownloadScreenshot || isDownloadingScreenshot || !onDownloadScreenshot}
            onClick={async () => {
              if (!onDownloadScreenshot) return;
              try {
                await onDownloadScreenshot();
                setSrStatus(t("sr_screenshot_saved"));
              } catch (error) {
                if (error?.name !== "AbortError") {
                  console.error("Failed to save catchment area screenshot", error);
                  alert(t("alert_screenshot_failed"));
                }
              }
            }}
            aria-label={t("download_screenshot")}
            title={t("download_screenshot")}
          >
            <span>
              {isDownloadingScreenshot
                ? t("download_screenshot_preparing")
                : t("download_screenshot")}
            </span>
          </button>
        </div>
      </div>
    );
  }
