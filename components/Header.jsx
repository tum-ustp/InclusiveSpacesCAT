import * as React from "react";
import PlasmicHeader from "./plasmic/saa_s_website/PlasmicHeader";
import sty from "./Header.module.css";
import { useTranslation } from "next-i18next";
import Link from "next/link";
import { useRouter } from "next/router";

function Header(
  {
    showHelp,
    setShowHelp = () => {},
    variant = "map", // "map" or "landing"
    canOpenSurvey = false,
    onOpenSurvey,
  },
  ref
) {
  const [showCityMenu, setShowCityMenu] = React.useState(false);
  const { t } = useTranslation("common");

  // navigation bar for keyboard user
  const [skipOpen, setSkipOpen] = React.useState(false);
  const skipNavRef = React.useRef(null);
  const firstSkipRef = React.useRef(null);

  const isTypingTarget = (target) => {
    if (!target) return false;
    const tag = target.tagName?.toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      target.isContentEditable
    );
  };

  // language selection setting
  const router = useRouter();
  const currentLocale = router.locale || "en";

  const isMethodologyPage = router.pathname === "/methodology";

  const helpBtnRef = React.useRef(null);
  const closeBtnRef = React.useRef(null);
  const modalContentRef = React.useRef(null);
  const lastFocusRef = React.useRef(null);

  const closeHelp = React.useCallback(() => {
    setShowHelp(false);
  }, [setShowHelp]);

  // naviagation bar for keyboard user
  React.useEffect(() => {
    const onKeyDown = (e) => { 
      if (isTypingTarget(e.target)) return;

      // Alt+N：navigation links
      if (e.altKey && e.code === "KeyN") {
        e.preventDefault();
        setSkipOpen(true); 
        requestAnimationFrame(() => {
          firstSkipRef.current?.focus();
        });
        return;
      }
      // Esc
      if (e.key === "Escape") {
        if (skipOpen) {
          e.preventDefault();
          setSkipOpen(false);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [skipOpen]);

  // show help
  React.useEffect(() => {
    if (!showHelp) return;
    lastFocusRef.current = document.activeElement;
    requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeHelp();
        return;
      }

      if (e.key === "Tab") {
        const root = modalContentRef.current;
        if (!root) return;

        const focusables = root.querySelectorAll(
          'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [showHelp, closeHelp]);

  React.useEffect(() => {
    if (showHelp) return;
    requestAnimationFrame(() => {
      const el = lastFocusRef.current;
      if (el && typeof el.focus === "function") el.focus();
      else helpBtnRef.current?.focus();
    });
  }, [showHelp]);

  // === left ===
  let left = null;
  // map page show all logos in header，landing only show CAT logo
  if (variant === "map") {
    left = (
      <div
        className={sty["logo-group"]}
        role="group"
        aria-label={t("header_partner_logos")}
      >
        {/* CAT logo*/}
        {/* <span className={sty["logo-wrapper"]}>
          <img
            src="/images/CAT_White.png"
            alt={t("logo_CAT_header")}
          />
        </span> */}

        {/* InclusiveSpaces logo  */}
        <Link
          href="https://inclusivespaces-heproject.eu/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("logo_IS")}
          title={t("logo_IS")}
          className={`${sty["logo-wrapper"]} ${sty.focusRing}`}
        >
          <img
            src="/images/Color_InclusiveSpaces.png"
            alt={t("logo_IS")}
          />
        </Link>
      </div>
    );
    // left = (
    //   <div
    //     className={sty["logo-group"]}
    //     role="group"
    //     aria-label={t("header_partner_logos")}
    //   >
    //     {/* EU logo (display only) */}
    //     <span className={sty["logo-wrapper"]}>
    //       <img
    //         src="/images/logo_co-founded-eu.png"
    //         alt={t("logo_EU")}
    //       />
    //     </span>

    //     {/* InclusiveSpaces logo  */}
    //     <span className={sty["logo-wrapper"]}>
    //       <img
    //         src="/images/logoIS.png"
    //         alt={t("logo_IS")}
    //       />
    //     </span>

    //     {/* TUM logo (display only) */}
    //     <span className={sty["logo-wrapper"]}>
    //       <img
    //         src="/images/tum_logo.png"
    //         alt={t("logo_TUM")}
    //       />
    //     </span>
    //   </div>
    // );

  } else if (variant === "landing") {
    // left = null;
    left = (
      <div
        className={sty["logo-group"]}
        role="group"
        aria-label={t("header_partner_logos")}
      >
        {/* CAT logo*/}
        <Link
          href="/"
          aria-label={t("CAT_link_home")}
          title={t("CAT_link_home")}
          className={`${sty["logo-wrapper"]} ${sty.focusRing}`}
        >
          <span className={sty["sr-only"]}>{t("CAT_link_home")}</span>
          <img
            src="/images/CAT_White.png"
            alt=""
            aria-hidden="true"
          />
        </Link>

        <p>by</p>
        <p>  </p>

        {/* InclusiveSpaces logo  */}
        <a
          href="https://inclusivespaces-heproject.eu/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("logo_IS")}
          title={t("logo_IS")}
          className={`${sty["logo-wrapper"]} ${sty.focusRing}`}
        >
          <img
            src="/images/White_inclusive spaces.png"
            alt={t("logo_IS")}
          />
        </a>

        {/* mehr verfahren paeg under construction */}
        {/* <button
          type="button"
          className={sty.methodologyBtn}
          aria-label={t("header_open_methodology")}
          onClick={() => alert("This page is currently under construction.")}
        >
          {t("header_learn_more")}
        </button> */}

        {/* after finishing mehr verfahren paeg */}
        <Link
          href="/methodology"
          className={`${sty.methodologyBtn} ${isMethodologyPage ? sty.methodologyBtnActive : ""}`}
          aria-label={t("header_open_methodology")}
        >
          {t("header_learn_more")}
        </Link>
      </div>
    ); 
  }

  // === middle ===
  let center = null;
  if (variant === "map") {
    center = (
      <div className={sty["center-title-wrapper"]}>
        <h1 className={sty["sr-only"]}>{t("landing_cat_title")}</h1>
        <Link
          href="/"
          aria-label={t("CAT_link_home")}
          title={t("CAT_link_home")}
          className={sty.focusRing}
        >
          <span className={sty["sr-only"]}>{t("CAT_link_home")}</span>
          <img
            src="/images/CAT_logo_blue.svg"
            alt=""
            aria-hidden="true"
            className={sty["CAT-logo"]}
          />
        </Link>
      </div>
    );
  }

  // === right: button ===
  const languages = ["de", "en", "el"];
  const languageName = {
    de: t("lang_german"),
    en: t("lang_english"),
    el: t("lang_greek"),
  };
  const right = (
    <>
      {/* language selection */}
      <nav
        className={sty["lang-switch-wrap"]}
        aria-label={t("aria_language_switcher")}
      >
        <ul className={sty["lang-list"]}>
          {languages.map((lng) => (
            <li key={lng} className={sty["lang-list-item"]}>
              <Link
                href={router.asPath}
                locale={lng}
                className={[
                  sty.langLink,
                  sty.focusRing,
                  currentLocale === lng ? sty["lang-active"] : ""
                ].filter(Boolean).join(" ")}
                aria-current={currentLocale === lng ? "page" : undefined}
                title={t("link_switch_language", { language: languageName[lng] })}
              >
                {lng.toUpperCase()}
                <span className={sty["sr-only"]}>
                  {" "}{t("link_switch_language", { language: languageName[lng] })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {variant === "map" && canOpenSurvey && (
        <button
          type="button"
          className={`${sty.surveyButton} ${sty.focusRing}`}
          onClick={onOpenSurvey}
          aria-haspopup="dialog"
          aria-controls="survey-prompt-title"
        >
          {t("survey_prompt_reopen")}
        </button>
      )}
      {/* map page show "help" button */}
      {variant === "map" && (
        <button
          ref={helpBtnRef}
          type="button"
          className={`${sty["help-button"]} ${sty.focusRing}`}
          title={t('header_tool_instruction')}
          aria-label={t('header_tool_instruction')}
          aria-haspopup="dialog"
          aria-expanded={showHelp}
          aria-controls={showHelp ? "help-dialog" : undefined}
          onClick={() => setShowHelp(true)}
        >
          <img src="/images/icon_info.png" alt="" aria-hidden="true" className={sty.helpButtonImg} />
        </button>
      )}
      {/* map page show "city selection" */}
      {variant === "map" && (
        <div className={sty["city-button-wrapper"]}>
          <button
            onClick={() => setShowCityMenu(prev => !prev)}
            className={`${sty["city-button"]} ${sty.focusRing}`}
            title={t('header_select_city')}
            aria-label={t('header_select_city')}
            aria-haspopup="menu"
            aria-expanded={showCityMenu}
            aria-controls="city-menu"
          >
            <img
              src="/images/select_city.png"
              alt={t('header_select_city')}
              className={sty["city-icon"]}
            />
          </button>
          {showCityMenu && (
            <div
              className={sty["city-dropdown"]}
              id="city-menu"
              role="menu"
              aria-label={t("header_select_city")}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowCityMenu(false);
              }}
            >
              {[
                { id: "hamburg", nameKey: "header_city_hamburg", defaultName: "Hamburg", center: [53.5503, 9.9920] },
                { id: "munich", nameKey: "header_city_munich", defaultName: "Munich", center: [48.1372, 11.5756] },
                { id: "penteli", nameKey: "header_city_penteli", defaultName: "Penteli", center: [38.0491, 23.8653] },
              ].map(city => {
                const cityName = t(city.nameKey, { defaultValue: city.defaultName });
                return (
                  <button
                    key={city.id}
                    type="button"
                    className={sty["city-item"]}
                    role="menuitem"
                    onClick={() => {
                      setShowCityMenu(false);
                      localStorage.setItem("selectedCity", city.id);
                      localStorage.setItem("selectedCityCenter", JSON.stringify(city.center));
                      window.location.href = `/user?city=${city.id}`;
                    }}
                    aria-label={t("header_switch_city", { city: cityName })}
                    title={t("header_switch_city", { city: cityName })}
                  >
                    {cityName}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );

  // header color variation (landing, map pages)
  const headerClass =
    variant === "landing"
      ? [sty["header-container"], sty["landing-header-bg"], sty["landing-header-text"]].join(" ")
      : sty["header-container"];

  const focusTarget = (e, id) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.setAttribute("tabindex", "-1");
    el.focus();
    window.location.hash = id;
  };

  return (
    <>
      <nav
        ref={skipNavRef}
        className={`${sty.skipLinks} ${skipOpen ? sty.skipLinksOpen : ""}`}
        aria-label={t("nav_links")}
        onBlur={(e) => { 
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setSkipOpen(false);
          }
        }}
      >
        {variant === "map" && (
          <>
            <a
              ref={firstSkipRef}
              href="#profile"
              className={sty.skipLink}
              onClick={(e) => focusTarget(e, "profile")}
            >
              {t("nav_to_profile")}
            </a>

            <a
              href="#sidebar"
              className={sty.skipLink}
              onClick={(e) => focusTarget(e, "sidebar")}
            >
              {t("nav_to_sidebar")}
            </a>

            <a
              href="#legend"
              className={sty.skipLink}
              onClick={(e) => focusTarget(e, "legend")}
            >
              {t("nav_to_results")}
            </a>

            <a
              href="#map-region"
              className={sty.skipLink}
              onClick={(e) => focusTarget(e, "map-region")}
            >
              {t("nav_to_map")}
            </a>
          </>
        )}
      </nav>

      <PlasmicHeader
        left={left}
        center={center}
        right={right}
        ref={ref}
        className={headerClass}
        navAriaLabel={
          variant === "landing"
            ? t("aria_language_switcher")
            : t("header_tools_nav")
        }
      />
      {/* "help" pop up in map page */}
      {variant === "map" && showHelp && (
        <div
          className={sty["modal-overlay"]}
          onClick={() => setShowHelp(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cat-help-title"
          id="help-dialog"
        >
          <div
            className={sty["modal-content"]}
            ref={modalContentRef}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ---------- 1.Row welcome title ---------- */}
            <div className={sty["modal-header-block"]}>
              <h2 id="cat-help-title" className={sty["modal-main-title"]}>
                {t("modal_help_title")}
              </h2> 
            </div>

            {/* ---------- 2. Row（AccessibilityControls + VariableControls） ---------- */}
            <h3 className={sty["modal-subtitle"]}>
              {t("modal_subtitle_steps")}
            </h3>
            <div className={sty["modal-row"]}>
              {/* Step 1: AccessibilityControls */}
              <div className={`${sty["modal-card"]} ${sty["modal-card-step"]}`}>
                <div className={sty["step-badge"]}>
                  <img src="/images/icon_accessibility.png" alt={t("icon_accessibility_control")} />
                </div>
                <h3 className={sty["modal-card-title"]}>
                  {t("accessibility_title")}
                </h3>
                <p className={sty["modal-card-text"]}>
                  {t("modal_howto_step_select_start")}
                </p>
                <p className={sty["modal-card-text"]}>
                  {t("modal_howto_step_adjust")}
                </p>
                
              </div>

              {/* Step 2: VariableControls */}
              <div className={`${sty["modal-card"]} ${sty["modal-card-step"]}`}>
                <div className={sty["step-badge"]}>
                  <img src="/images/icon_features.png" alt={t("icon_discomfort_feature")} />
                </div>
                <h3 className={sty["modal-card-title"]}>
                  {t("leg_comfort_features")}
                </h3>
                <p className={sty["modal-card-text"]}>
                  {t("modal_howto_step_enable_features")}
                </p>
                <p className={sty["modal-card-text"]}>
                  {t("modal_tips_step_adjust_weights")}
                </p>
                <p className={sty["modal-card-text"]}>
                  {t("modal_howto_step_get_area")}
                </p>
              </div>
            </div>

            {/* ---------- 3. Row：3 cards（Profile / Legend / MapLayers） ---------- */}
            <h3 className={sty["modal-subtitle"]}>
              {t("modal_subtitle_more")}
            </h3>
            <div className={sty["modal-row"]}>
              {/* MapLayers card/ data information */}
              <div className={`${sty["modal-card"]} ${sty["modal-card-icon"]} ${sty["icon-card"]}`}>
                <div className={sty["icon-circle"]}>
                  <img src="/images/help_data.png" alt={t("icon_data_info")} />
                </div>
                <h3 className={sty["icon-card-title"]}>
                  {t("map_layers")}
                </h3>
                <p className={sty["icon-card-text"]}>
                  {t("modal_layers_desc")}
                </p>
              </div>

              {/* Profile card */}
              <div className={`${sty["modal-card"]} ${sty["modal-card-icon"]} ${sty["icon-card"]}`}>
                <div className={sty["icon-circle"]}>
                  <img src="/images/profile.png" alt={t("icon_profile")} />
                </div>
                <h3 className={sty["icon-card-title"]}>
                  {t("profile_title")}
                </h3>
                <p className={sty["icon-card-text"]}>
                  {t("modal_profile_desc")}
                </p>
              </div>

              {/* Legend card/ catchemtn area results */}
              <div className={`${sty["modal-card"]} ${sty["modal-card-icon"]} ${sty["icon-card"]}`}>
                <div className={sty["icon-circle"]}>
                  <img src="/images/help_result.png" alt={t("icon_catchment_area")} />
                </div>
                <h3 className={sty["icon-card-title"]}>
                  {t("leg_catchment_result")}
                </h3>
                <p className={sty["icon-card-text"]}>
                  {t("modal_legend_desc")}
                </p>
              </div>
              
            </div>

            {/* Keyboard shortcut hints */}
            <div className={sty.shortcutHints}>

              {/* --- Hint 1: Keyboard user tip (Skip navigation) --- */}
              <div className={sty.shortcutHint}>
                {/* Screen reader only */}
                <span className={sty.srOnly}>
                  {t("modal_shortcut_skipnav_sr")}
                </span>

                {/* Visual block, hidden from screen readers */}
                <div className={sty.shortcutBlock} aria-hidden="true">
                  {/* Left column: icon + title */}
                  <div className={sty.shortcutLeft}>
                    <img
                      src="/images/keyboard.svg"
                      alt=""
                      aria-hidden="true"
                      className={sty.shortcutIcon}
                    />
                    <span className={`${sty.shortcutText} ${sty.shortcutTitleText}`}>
                      {t("modal_shortcut_skipnav_title")}
                    </span>
                  </div>

                  {/* Right column: instructions (multiple rows) */}
                  <div className={sty.shortcutRight}>
                    <div className={sty.shortcutLine}>
                      <span className={sty.shortcutText}>{t("modal_shortcut_skipnav_line1_prefix")}</span>
                      <span className={sty.kbdCombo}>
                        <span className={sty.kbdKey}>Alt</span>
                        <span className={sty.kbdPlus}>+</span>
                        <span className={sty.kbdKey}>N</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- Hint 2: Map navigation with keyboard (WCAG 2.5.7) --- */}
              <div className={sty.shortcutHint}>
                {/* Screen reader only */}
                <span className={sty.srOnly}>
                  {t("modal_shortcut_map_nav_sr")}
                </span>

                {/* Visual block, hidden from screen readers */}
                <div className={sty.shortcutBlock} aria-hidden="true">
                  {/* Left column: icon + title */}
                  <div className={sty.shortcutLeft}>
                    <img
                      src="/images/keyboard.svg"
                      alt=""
                      aria-hidden="true"
                      className={sty.shortcutIcon}
                    />
                    <span className={`${sty.shortcutText} ${sty.shortcutTitleText}`}>
                      {t("modal_shortcut_map_nav_title")}
                    </span>
                  </div>

                  {/* Right column: 3 rows */}
                  <div className={sty.shortcutRight}>
                    <div className={sty.shortcutLine}>
                      <span className={sty.shortcutText}>
                        {t("modal_shortcut_map_nav_line1_prefix")}
                      </span>
                      <span className={sty.kbdCombo}>
                        <span className={sty.kbdKey}>Tab</span>
                      </span>
                    </div>

                    <div className={sty.shortcutLine}>
                      <span className={sty.shortcutText}>
                        {t("modal_shortcut_map_nav_line2_prefix")}
                      </span>
                      <span className={sty.kbdCombo}>
                        <span className={sty.kbdKey}>↑</span>
                        <span className={sty.kbdKey}>↓</span>
                        <span className={sty.kbdKey}>←</span>
                        <span className={sty.kbdKey}>→</span>
                      </span>
                    </div>

                    <div className={sty.shortcutLine}>
                      <span className={sty.shortcutText}>
                        {t("modal_shortcut_map_nav_line3_prefix")}
                      </span>
                      <span className={sty.kbdCombo}>
                        <span className={sty.kbdKey}>+</span>
                        <span className={sty.kbdPlus}>/</span>
                        <span className={sty.kbdKey}>-</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>


            {/* ---------- close button ---------- */}
            <button
              ref={closeBtnRef}
              type="button"
              onClick={() => setShowHelp(false)}
              className={sty["modal-close"]}
            >
              {t("modal_close")}
            </button>
          </div>

        </div>
      )}
    </>
  );
}

export default React.forwardRef(Header);
