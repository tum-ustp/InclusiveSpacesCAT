import React, { useState } from "react"; 
import sty from "./Sidebar.module.css";
import { useTranslation } from "next-i18next";



export default function Profile({
  setEnabledVariables,
  setLayerValues,
  setWalkingSpeed
}) {
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState(null);

  const PROFILE_PRESETS = [
    {
      id: "elderly",
      labelKey: "profile_elderly",
      defaultLabel: t("profile_elderly"),
      icon: "/images/profile_elderly.png",
      enabled: [
        "temperatureSummer",
        "temperatureWinter",
        "light",
        "tree",
        "narrowRoads",
        "stair",
        "unevenSurface", 
        "kerbsHigh",
      ],
      values: {
        temperatureSummer: 0.1,
        temperatureWinter: 0.1,
        light: 0.5,
        tree: 0.5,
        narrowRoads: 0.7,
        stair: 0.5,
        unevenSurface: 0.5, 
        kerbsHigh: 0.7,
      },
      walkingSpeed: 3.7,
    },
    {
      id: "stroller",
      labelKey: "profile_stroller",
      defaultLabel: t("profile_stroller"),
      icon: "/images/profile_stroller.png",
      enabled: [
        "temperatureWinter",
        "light",
        "narrowRoads",
        "obstacle",
        "poorPavement",
        "pedestrianFlow",
      ],
      values: {
        temperatureWinter: 0.7,
        light: 0.5,
        narrowRoads: 0.5,
        obstacle: 0.7,
        poorPavement: 0.7,
        pedestrianFlow: 0.5,
      },
      walkingSpeed: 3.8,
    },
    {
      id: "wheelchair",
      labelKey: "profile_wheelchair",
      defaultLabel: t("profile_wheelchair"),
      icon: "/images/profile_wheelchair.png",
      enabled: [
        "temperatureWinter",
        "light",
        "stair",
        "obstacle",
        "unevenSurface",
        "poorPavement",
        "kerbsHigh",
        "facility",
      ],
      values: {
        temperatureWinter: 0.5,
        light: 0.1,
        stair: 0.1,
        obstacle: 0.5,
        unevenSurface: 0.1,
        poorPavement: 0.1,
        kerbsHigh: 0.1,
        facility: 0.5,
      },
      walkingSpeed: 1.7,
    },
    {
      id: "visual_impairment",
      labelKey: "profile_visual_impairment",
      defaultLabel: t("profile_visual"),
      icon: "/images/profile_blind.png",
      enabled: [
        "noise",
        "trafficLight",
        "tactile_pavement",
        "obstacle",
        "unevenSurface"
      ],
      values: {
        noise: 0.7,
        trafficLight: 0.7,
        tactile_pavement: 0.7,
        obstacle: 0.5,
        unevenSurface: 0.7,
      },
      walkingSpeed: 3.1
    },
    {
      id: "hearing_impairment",
      labelKey: "profile_hearing_impairment",
      defaultLabel: t("profile_hearing"),
      icon: "/images/profile_hearing.png",
      enabled: [
        "noise",
        "light",
        "trafficLight",
        "pedestrianFlow"
      ],
      values: {
        noise: 0.7,
        light: 0.7,
        trafficLight: 0.7,
        pedestrianFlow: 0.7
      },
      walkingSpeed: 3.5
    },
    {
      id: "cognitive_impairment",
      labelKey: "profile_cognitive_impairment",
      defaultLabel: t("profile_cognitive"),
      icon: "/images/profile_cognitive.png",
      enabled: [
        "temperatureWinter",
        "light",
        "narrowRoads",
        "unevenSurface",
        "pedestrianFlow"
      ],
      values: {
        temperatureWinter: 0.7,
        light: 0.5,
        narrowRoads: 0.7,
        unevenSurface: 0.7,
        pedestrianFlow: 0.5
      },
      walkingSpeed: 3.6
    }

  ]; 

  const applyProfile = (profileId) => { 
    if (activeProfile === profileId) {
      setActiveProfile(null);
      return;
    }

    const profile = PROFILE_PRESETS.find((p) => p.id === profileId);
    if (!profile) return;

    setEnabledVariables(profile.enabled);

    setLayerValues((prev) => {
      const next = { ...prev };
      Object.entries(profile.values).forEach(([key, value]) => {
        next[key] = value;
      });
      return next;
    });

    if (setWalkingSpeed && typeof profile.walkingSpeed === "number") {
      setWalkingSpeed(profile.walkingSpeed);
    }

    setActiveProfile(profileId);
  };

  const titleText = t("profile_title");

  return (
    <section
      id="profile"
      tabIndex={-1}
      className={sty.profilePanel}
      aria-label={titleText}
    >
      {/* Collapsed state */}
      {!isOpen && (
        <button
          type="button"
          className={sty.profileMainBox}
          onClick={() => setIsOpen(true)}
          aria-label={titleText}
          aria-expanded={isOpen}
        >
          <span className={sty.profileMainTitle}>{titleText}</span>
          <span className={sty.profileMainIconWrapper}>
            <img
              src="/images/profile.png"
              alt=""
              aria-hidden="true"
              className={sty.profileMainIcon}
            />
          </span>
        </button>
      )}

      {/* Expanded state */}
      {isOpen && (
        <div className={sty.profileBarExpanded}>
          <div
            className={sty.profileOptions}
            role="list"
            aria-label={t("profile_title")}
          >
            {PROFILE_PRESETS.map((profile) => {
              const label = t(profile.labelKey, {
                defaultValue: profile.defaultLabel
              });
              const isActive = activeProfile === profile.id;

              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => applyProfile(profile.id)}
                  className={`${sty["profile-icon-button"]} ${
                    isActive ? sty["profile-icon-button-active"] : ""
                  }`}
                  aria-pressed={isActive}
                  aria-label={label}
                  role="listitem"
                >
                  <img
                    src={profile.icon}
                    alt=""
                    aria-hidden="true"
                    className={sty["profile-icon-img"]}
                  />
                  <span className={sty["profile-icon-label"]}>{label}</span>
                </button>
              );
            })}
          </div> 
          {/* main profile */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className={sty.profileMainIconOnlyButton}
            aria-label={t("profile_collapse")}
            title={t("profile_collapse")}
          >
            <img
              src="/images/profile.png"
              alt=""
              aria-hidden="true"
              className={sty.profileMainIcon}
            />
          </button>
        </div>
      )}
    </section>
  );
} 