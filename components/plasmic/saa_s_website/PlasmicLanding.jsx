import React, { useState } from "react";
import { useRouter } from "next/router";
import Header from "../../Header";
import sty from "./PlasmicLanding.module.css";
import { useTranslation } from "next-i18next";

export default function PlasmicLanding() {
  const router = useRouter();
  const { t } = useTranslation("common");

  const cities = [
    { id: "hamburg", name: "Hamburg", logo: "/images/hamburg_logo.png", center: [53.5503, 9.9920] }, 
    { id: "penteli", name: "Penteli", logo: "/images/penteli_logo.png", center: [38.0491, 23.8653] },
  ];

  const [selectedCity, setSelectedCity] = useState("hamburg");

  const handleEnterMap = () => {
    const selected = cities.find(c => c.id === selectedCity);
    if (!selected) return; 

    localStorage.setItem("selectedCity", selectedCity);
    localStorage.setItem("selectedCityCenter", JSON.stringify(selected.center));

    router.push({
        pathname: "/user",
        query: { city: selectedCity }
    });
  };

  const enterCity = (id, center) => {
    localStorage.setItem("selectedCity", id);
    localStorage.setItem("selectedCityCenter", JSON.stringify(center));
    sessionStorage.removeItem("helpShown");
    router.push(`/user?city=${id}`);
  };

  const bannerBgUrl = "/images/landing_bg2.png"; 

  return (
    <div className={sty.container}>
      <Header variant="landing"/>

      {/* === CAT === */}
      <section
        className={sty.banner}
        style={{
          "--banner-bg-image": `url("${bannerBgUrl}")`
        }}
      >
        <div className={sty.bannerGrid}>
          {/* === First row: CAT intro + city card === */}
          <div className={sty.bannerRow}>
            {/* Left content */}
            <div className={`${sty.bannerCol} ${sty.bannerColLeft}`}>
              <h1 className={sty["sr-only"]}>{t("landing_cat_title")}</h1>

              <div className={`${sty.brandWrap} ${sty.brandWrapLogo}`}>
                <img
                  src="/images/CAT_title_white.svg"
                  alt="" 
                  aria-hidden="true"
                  className={sty.catTitleImg}
                />
              </div>

              <div className={`${sty.brandWrap} ${sty.brandWrapFull}`}>
                <div className={sty.introCard}> 
                  <p className={sty.introText}>{t('landing_banner_intro')}</p>
                </div>
              </div>

              <div className={`${sty.brandWrap} ${sty.brandWrapFull}`}>
                <div className={sty.contactActionBlock}>
                  <div className={sty.contactCaption}>
                    {t('landing_banner_contact_caption')}
                  </div>

                  <div className={sty.contactActions}>
                    <button
                      className={sty.contactBtn}
                      onClick={() => {
                        const block = document.getElementById('contact-info');
                        if (block) block.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      {t('landing_banner_contact_btn')}
                    </button>

                    {/* <button
                      className={sty.feedbackBtn}
                      onClick={() => alert(t('feature_under_construction'))}
                    >
                      {t('landing_banner_share_btn')}
                    </button> */}
                  </div>
                </div>
              </div>
            </div>

            {/* Right city cards */}
            <div className={`${sty.bannerCol} ${sty.bannerColRight}`}>
              <div className={sty.cityBoard}>
                <h2 className={sty.cityTitle}>{t('landing_city_section_title')}</h2>

                <div>
                  {/* Hamburg */}
                  <div
                    className={sty.cityCardRow}
                    onClick={() => enterCity("hamburg", [53.5503, 9.9920])}
                    role="button"
                    aria-label={t('landing_city_hamburg')}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        enterCity("hamburg", [53.5503, 9.9920]);
                      }
                    }}
                  >
                    <div className={sty.cityCircle}>
                      <span className={sty.cityCircleLabel}>{t('landing_city_hamburg')}</span>
                      <img
                        src="/images/hamburg_map.png"
                        alt=""
                        role="presentation"
                        aria-hidden="true"
                        className={sty.cityThumb}
                      />
                    </div>
                    <div className={sty.cityRect}>
                      <p>{t('landing_city_hamburg_desc')}</p>
                    </div>
                  </div>

                  {/* Penteli */}
                  <div
                    className={sty.cityCardRow}
                    onClick={() => enterCity("penteli", [38.0491, 23.8653])}
                    role="button"
                    aria-label={t('landing_city_penteli')}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        enterCity("penteli", [38.0491, 23.8653]);
                      }
                    }}
                  >
                    <div className={sty.cityCircle}>
                      <span className={sty.cityCircleLabel}>{t('landing_city_penteli')}</span>
                      <img
                        src="/images/penteli_map.png"
                        alt=""
                        role="presentation"
                        aria-hidden="true"
                        className={sty.cityThumb}
                      />
                    </div>
                    <div className={sty.cityRect}>
                      <p>{t('landing_city_penteli_desc')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* === More description === */}
      <section className={sty.toolDetailsSection}>
        {/* ---- Details about CAT ---- */}
        <div className={sty.toolDetailsGrid}>
          <div className={sty.stickerCard}>
            <h2 className={sty.toolDetailsTitle}>
              {t("landing_about")}{" "}
              <img
                src="/images/CAT_dark_Purple.png"
                alt="CAT"
                className={sty.inlineCatLogo}
              />
            </h2>
            <div className={sty.toolDetailsText}>
              {t("landing_details_blocks", { returnObjects: true }).map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>
          </div>
          <div className={sty.stickerCard}>
            <h2 className={sty.toolDetailsTitle}>{t('landing_target_group_title')}</h2>
            <div className={sty.toolDetailsText}>
              {t("landing_target_group_blocks", { returnObjects: true }).map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>
          </div>
        </div>

        {/* ---- General information ---- */}
        {/* <div className={sty.stickerCard}>
          <h2 className={sty.toolDetailsTitle}>{t('landing_general_title')}</h2>
          <div className={sty.toolDetailsInner}>

            <div className={sty.toolDetailsLeftCol}>
              <div className={sty.toolDetailsLogoWrap}>
                <img
                  src="/images/logo_co-founded-eu_full.png"
                  alt={t('logo_EU')}
                  className={sty.toolDetailsLogo}
                />
              </div>
              <div className={sty.toolDetailsLogoWrap}>
                <img
                  src="/images/build4people_logo.png"
                  alt={t('logo_Build4People')}
                  className={sty.toolDetailsLogo}
                />
              </div>
            </div>

            <div className={sty.toolDetailsRight}>
              <div className={sty.toolDetailsText}>
                {t("landing_general_blocks", { returnObjects: true }).map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </div>
          </div> 
        </div> */}
      </section> 

      {/* === Contact info (footer) === */}
      <section className={sty.contactSection}>
        <div className={sty.contactGrid}>
          {/* col 1: CAT logo */}
          <div className={sty.contactColLogo}>
            <img
              src="/images/CAT_White.png"
              alt="CAT"
              className={sty.contactCatLogo}
            />
          </div>

          {/* middle area: disclaimer + contact */}
          <div className={sty.contactColMain}>
            <div className={sty.disclaimerText}>
              <p>
                {t("landing_disclaimer_1")}{" "}
                <a
                  href="https://inclusivespaces-heproject.eu/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  InclusiveSpaces
                </a>{" "}
                {t("landing_disclaimer_2")}
              </p>
              <p>{t("landing_disclaimer_3")}</p>
            </div>
 
            <div id="contact-info" className={sty.contactText}>
              <h3 className={sty.contactMiniTitle}>{t("landing_contact_title")}</h3>

              <div className={sty.contactList}>
                <div className={sty.contactLine}>
                  <span className={sty.contactName}>{t("landing_contact_duran")}</span>
                  <a className={sty.contactEmail} href="mailto:david.duran@tum.de">
                    david.duran@tum.de
                  </a>
                </div>

                <div className={sty.contactLine}>
                  <span className={sty.contactName}>{t("landing_contact_buettner")}</span>
                  <a className={sty.contactEmail} href="mailto:benjamin.buettner@tum.de">
                    benjamin.buettner@tum.de
                  </a>
                </div>

                <div className={sty.contactLine}>
                  <span className={sty.contactName}>{t("landing_contact_zuckriegl")}</span>
                  <a className={sty.contactEmail} href="mailto:lea.zuckriegl@tum.de">
                    lea.zuckriegl@tum.de
                  </a>
                </div>

                <div className={sty.contactLine}>
                  <span className={sty.contactName}>{t("landing_contact_zuniga")}</span>
                  <a className={sty.contactEmail} href="mailto:mariajose.zuniga@tum.de">
                    mariajose.zuniga@tum.de
                  </a>
                </div>

                <div className={sty.contactLine}>
                  <span className={sty.contactName}>{t("landing_contact_huashu")}</span>
                  <a className={sty.contactEmail} href="mailto:huashu.zhan@tum.de">
                    huashu.zhan@tum.de
                  </a>
                </div>

                <div className={sty.contactLine}>
                  <span className={sty.contactName}>{t("landing_contact_rita")}</span>
                  <a className={sty.contactEmail} href="mailto:margarita.zykova@tum.de">
                    margarita.zykova@tum.de
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* col 4: partner logos */}
          <div className={sty.contactColPartners}>
            <div className={sty.partnerLogoColumn}>
              <img
                src="/images/logoIS_full.png"
                alt={t("logo_IS")}
                className={sty.partnerLogoImg}
              />
              <img
                src="/images/tum_logo_full.png"
                alt={t("logo_TUM")}
                className={sty.partnerLogoImg}
              />
              <img
                src="/images/logo_co-founded-eu_full.png"
                alt={t("logo_EU")}
                className={sty.partnerLogoImg}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
