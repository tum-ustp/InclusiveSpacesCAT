import * as React from "react"; 
import Head from "next/head";
import { useRouter } from "next/router";
import {
  Stack as Stack__,
  classNames,
  createPlasmicElementProxy,
  deriveRenderOpts,
  useDollarState
} from "@plasmicapp/react-web";
import { useDataEnv } from "@plasmicapp/react-web/lib/host";
import Header from "../../Header";
import "@plasmicapp/react-web/lib/plasmic.css"; 
import projectcss from "./plasmic.module.css";
import sty from "./PlasmicUser.module.css";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import Sidebar from "../../Sidebar";
import LayerTagBar from "@/components/LayerTagBar";
import Profile from "../../Profile";
import { cityLayerConfig } from "../../cityVariableConfig";

const MapComponent = dynamic(() => import("../../MapComponent"), { ssr: false });

createPlasmicElementProxy;

export const PlasmicUser__VariantProps = [];
export const PlasmicUser__ArgProps = [];

function useNextRouter() {
  try {
    return useRouter();
  } catch {}
  return undefined;
}

function PlasmicUser__RenderFunc(props) {
  const { variants, overrides, forNode } = props;
  const [selectingStart, setSelectingStart] = React.useState(false);
  const [startPoints, setStartPoints] = React.useState([]);
  const [computeAccessibility, setComputeAccessibility] = React.useState(false);
  const [walkingTime, setWalkingTime] = React.useState(15);
  const [walkingSpeed, setWalkingSpeed] = React.useState(5);
  const [selectedLayers, setSelectedLayers] = React.useState([]);
  const [enabledVariables, setEnabledVariables] = React.useState([]);
  const [layerValues, setLayerValues] = React.useState({});
  const [availableLayers, setAvailableLayers] = React.useState([]);
  const [openCategory, setOpenCategory] = React.useState(null);
  const [showInfo, setShowInfo] = React.useState(false);
  const [resetTrigger, setResetTrigger] = React.useState(false);
  const [clearTrigger, setClearTrigger] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [highlightedIndex, setHighlightedIndex] = React.useState(null);
  const [cityCenter, setCityCenter] = React.useState([53.5503, 9.9920]); // hamburg as default
  const [isSearchZoom, setIsSearchZoom] = React.useState(false);
  const [canDownloadScreenshot, setCanDownloadScreenshot] = React.useState(false);
  const [isDownloadingScreenshot, setIsDownloadingScreenshot] = React.useState(false);
  const [canOpenSurvey, setCanOpenSurvey] = React.useState(false);
  const screenshotHandlerRef = React.useRef(null);
  const surveyOpenHandlerRef = React.useRef(null);
 
  const [showHelp, setShowHelp] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("helpShown")) {
      setShowHelp(true);
      sessionStorage.setItem("helpShown", "true");
    }
  }, []);


  React.useEffect(() => {
    const storedCenter = localStorage.getItem("selectedCityCenter");
    if (storedCenter) {
      try {
        setCityCenter(JSON.parse(storedCenter));
      } catch (e) {
        console.error("Invalid city center in storage", e);
      }
    }
  }, []);

  React.useEffect(() => {
    const city =
      (typeof window !== "undefined" &&
        (localStorage.getItem("selectedCity") || "hamburg")) ||
      "hamburg";

    setAvailableLayers(cityLayerConfig?.[city]?.mapLayers || []);
  }, []);

  const toggleCategory = (category) => {
    setOpenCategory(openCategory === category ? null : category);
  };

  const handleResetResults = () => {
    setComputeAccessibility(false);
    setStartPoints([]);
    setResetTrigger(true);
    // setEnabledVariables([]);
    // setLayerValues({}); 
  };
  const handleClearResult = () => {
    setClearTrigger(true);
  };
  const handleClearVariables = () => {
    setEnabledVariables([]);
    setLayerValues({});
  };


  const onResetHandled = () => {
    setResetTrigger(false);
  };
  const onClearHandled = () => {
    setClearTrigger(false);
  };

  const toggleVariable = (layer) => {
    setEnabledVariables((prev) => {
      const isSelected = prev.includes(layer);
      const newEnabled = isSelected
        ? prev.filter((l) => l !== layer)
        : [...prev, layer];
      if (!isSelected) {
        setLayerValues((prevValues) => ({
          ...prevValues,
          [layer]: prevValues[layer] ?? 1.0
        }));
      }
      if (isSelected) {
        setLayerValues((prevValues) => {
          const updated = { ...prevValues };
          delete updated[layer];
          return updated;
        });
      }

      return newEnabled;
    });
  };

  const toggleLayer = (layer) => {
    setSelectedLayers((prev) => {
      const newLayers = prev.includes(layer)
        ? prev.filter((l) => l !== layer)
        : [...prev, layer];
      if (!prev.includes(layer)) {
        setLayerValues((prevValues) => ({
          ...prevValues,
          [layer]: prevValues[layer] || 1.0,
        }));
      }
      return newLayers;
    });
  };

  const handleInputChange = (event, layer) => {
    const value = parseFloat(event.target.value);
    setLayerValues((prev) => ({
      ...prev,
      [layer]: isNaN(value) ? prev[layer] || 1.0 : value,
    }));
  };

  const handleDownloadScreenshot = React.useCallback(async () => {
    if (!screenshotHandlerRef.current) return;
    setIsDownloadingScreenshot(true);
    try {
      await screenshotHandlerRef.current();
    } finally {
      setIsDownloadingScreenshot(false);
    }
  }, []);

  const handleOpenSurvey = React.useCallback(() => {
    surveyOpenHandlerRef.current?.();
  }, []);

  return (
    <React.Fragment>
      <Head></Head>
      <style>{`body { margin: 0; }`}</style>
      <div className={projectcss.plasmic_page_wrapper}>
        <Stack__
          as="div"
          data-plasmic-name="root"
          data-plasmic-override={overrides?.root}
          data-plasmic-root
          data-plasmic-for-node={forNode}
          hasGap
          className={classNames(
            projectcss.all,
            projectcss.root_reset,
            projectcss.plasmic_default_styles,
            projectcss.plasmic_mixins,
            projectcss.plasmic_tokens, 
            sty.root
          )}
        >
          <Header 
            showHelp={showHelp}
            setShowHelp={setShowHelp}
            variant="map"
            canOpenSurvey={canOpenSurvey}
            onOpenSurvey={handleOpenSurvey}
            data-plasmic-name="header"
            data-plasmic-override={overrides?.header}
            className={classNames("__wab_instance", sty.header)}
          />
          <div data-plasmic-name="mapBox" data-plasmic-override={overrides?.mapBox} className={classNames(projectcss.all, sty.mapBox)} id="map">
            <Profile
              setEnabledVariables={setEnabledVariables}
              setLayerValues={setLayerValues}
              setWalkingSpeed={setWalkingSpeed}
            />
            <Sidebar
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              enabledVariables={enabledVariables}
              toggleVariable={toggleVariable}
              selectedLayers={selectedLayers}
              toggleLayer={toggleLayer}
              layerValues={layerValues}
              availableLayers={availableLayers}
              handleInputChange={handleInputChange}
              walkingTime={walkingTime}
              setWalkingTime={setWalkingTime}
              walkingSpeed={walkingSpeed}
              setWalkingSpeed={setWalkingSpeed}
              setSelectingStart={setSelectingStart}
              startPoints={startPoints}
              setStartPoints={setStartPoints} 
              setComputeAccessibility={setComputeAccessibility}
              handleResetResults={handleResetResults}
              handleClearResult={handleClearResult}
              handleClearVariables={handleClearVariables}
              openCategory={openCategory}
              toggleCategory={toggleCategory}
              showInfo={showInfo}
              setShowInfo={setShowInfo}
              isSearchZoom={isSearchZoom}
              setIsSearchZoom={setIsSearchZoom}
              onDownloadScreenshot={handleDownloadScreenshot}
              canDownloadScreenshot={canDownloadScreenshot}
              isDownloadingScreenshot={isDownloadingScreenshot}
            />            
            <LayerTagBar
              selectedLayers={selectedLayers}
              toggleLayer={toggleLayer}
              availableLayers={availableLayers}
            />
            <MapComponent
              cityCenter={cityCenter}
              selectedLayers={selectedLayers}
              availableLayers={availableLayers}
              enabledVariables={enabledVariables}
              selectingStart={selectingStart}
              setSelectingStart={setSelectingStart}
              walkingTime={walkingTime}
              walkingSpeed={walkingSpeed}
              startPoints={startPoints}
              setStartPoints={setStartPoints}
              computeAccessibility={computeAccessibility}
              setComputeAccessibility={setComputeAccessibility}
              resetTrigger={resetTrigger}
              onResetHandled={onResetHandled}
              clearTrigger={clearTrigger}
              onClearHandled={onClearHandled}
              layerValues={layerValues}
              highlightedIndex={highlightedIndex} 
              setHighlightedIndex={setHighlightedIndex}
              isSearchZoom={isSearchZoom}
              setIsSearchZoom={setIsSearchZoom} 
              onScreenshotReady={(handler) => {
                screenshotHandlerRef.current = handler;
              }}
              onScreenshotAvailabilityChange={setCanDownloadScreenshot}
              onSurveyOpenReady={(handler) => {
                surveyOpenHandlerRef.current = handler;
              }}
              onSurveyAvailabilityChange={setCanOpenSurvey}
            />
          </div>

        </Stack__>
      </div>
    </React.Fragment>
  );
}

export default function PlasmicUser(props) {
  return <PlasmicUser__RenderFunc {...props} />;
}
 
