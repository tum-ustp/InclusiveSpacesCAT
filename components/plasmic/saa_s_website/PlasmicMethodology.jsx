import React, { useState } from "react";
import sty from "./PlasmicLanding.module.css";
import { useTranslation, Trans } from "next-i18next";

export default function Methodology() {
  const { t } = useTranslation("common");
  const [showMobilityTable, setShowMobilityTable] = useState(false);

  const mobilityProfilesTable = [
    {
      group: t("methodology.mobility_table.groups.physical"),
      rows: [
        [t("checkbox_temp_winter"), t("emoji_level_2"), t("methodology.mobility_table.stories.physical.cold_weather")],
        [t("checkbox_light"), t("emoji_level_1"), t("methodology.mobility_table.stories.physical.no_street_lights")],
        [t("checkbox_stair"), t("emoji_level_1"), t("methodology.mobility_table.stories.physical.stairs_only")],
        [t("checkbox_obstacle"), t("emoji_level_2"), t("methodology.mobility_table.stories.physical.obstacles")],
        [t("checkbox_uneven"), t("emoji_level_1"), t("methodology.mobility_table.stories.physical.uneven_surfaces")],
        [t("checkbox_poor"), t("emoji_level_1"), t("methodology.mobility_table.stories.physical.poor_pavement")],
        [t("checkbox_kerb"), t("emoji_level_1"), t("methodology.mobility_table.stories.physical.high_kerbs")],
        [t("checkbox_facility"), t("emoji_level_2"), t("methodology.mobility_table.stories.physical.no_facilities")]
      ]
    },
    {
      group: t("methodology.mobility_table.groups.visual"),
      rows: [
        [t("checkbox_noise"), t("emoji_level_3"), t("methodology.mobility_table.stories.visual.noise_pollution")],
        [t("checkbox_traffic"), t("emoji_level_3"), t("methodology.mobility_table.stories.visual.no_traffic_lights")],
        [t("checkbox_tactile"), t("emoji_level_3"), t("methodology.mobility_table.stories.visual.no_tactile_paths")],
        [t("checkbox_obstacle"), t("emoji_level_2"), t("methodology.mobility_table.stories.visual.obstacles")],
        [t("checkbox_uneven"), t("emoji_level_3"), t("methodology.mobility_table.stories.visual.uneven_surface")]
      ]
    },
    {
      group: t("methodology.mobility_table.groups.carer"),
      rows: [
        [t("checkbox_temp_winter"), t("emoji_level_3"), t("methodology.mobility_table.stories.carer.cold_weather")],
        [t("checkbox_light"), t("emoji_level_2"), t("methodology.mobility_table.stories.carer.no_street_lighting")],
        [t("checkbox_narrow"), t("emoji_level_2"), t("methodology.mobility_table.stories.carer.narrow_sidewalk")],
        [t("checkbox_obstacle"), t("emoji_level_3"), t("methodology.mobility_table.stories.carer.obstacles")],
        [t("checkbox_poor"), t("emoji_level_3"), t("methodology.mobility_table.stories.carer.poor_pavement")],
        [t("checkbox_crowd"), t("emoji_level_2"), t("methodology.mobility_table.stories.carer.crowded_areas")]
      ]
    },
    {
      group: t("methodology.mobility_table.groups.hearing"),
      rows: [
        [t("checkbox_noise"), t("emoji_level_3"), t("methodology.mobility_table.stories.hearing.noise_pollution")],
        [t("checkbox_light"), t("emoji_level_3"), t("methodology.mobility_table.stories.hearing.no_street_lighting")],
        [t("checkbox_traffic"), t("emoji_level_3"), t("methodology.mobility_table.stories.hearing.no_traffic_lights")],
        [t("checkbox_obstacle"), t("emoji_level_2"), t("methodology.mobility_table.stories.hearing.signs")],
        [t("checkbox_crowd"), t("emoji_level_3"), t("methodology.mobility_table.stories.hearing.crowded_areas")]
      ]
    },
    {
      group: t("methodology.mobility_table.groups.intellectual"),
      rows: [
        [t("checkbox_temp_winter"), t("emoji_level_3"), t("methodology.mobility_table.stories.intellectual.cold_weather")],
        [t("checkbox_light"), t("emoji_level_2"), t("methodology.mobility_table.stories.intellectual.lighting")],
        [t("checkbox_narrow"), t("emoji_level_3"), t("methodology.mobility_table.stories.intellectual.narrow_sidewalk")],
        [t("checkbox_uneven"), t("emoji_level_3"), t("methodology.mobility_table.stories.intellectual.uneven_surface")],
        [t("checkbox_crowd"), t("emoji_level_2"), t("methodology.mobility_table.stories.intellectual.crowded_areas")]
      ]
    },
    {
      group: t("methodology.mobility_table.groups.older"),
      rows: [
        [t("checkbox_temp_summer"), t("emoji_level_1"), t("methodology.mobility_table.stories.older.hot_temperature")],
        [t("checkbox_temp_winter"), t("emoji_level_1"), t("methodology.mobility_table.stories.older.cold_temperature")],
        [t("checkbox_light"), t("emoji_level_2"), t("methodology.mobility_table.stories.older.no_street_lights")],
        [t("checkbox_tree"), t("emoji_level_2"), t("methodology.mobility_table.stories.older.no_tree_shade")],
        [t("checkbox_narrow"), t("emoji_level_3"), t("methodology.mobility_table.stories.older.narrow_sidewalk")],
        [t("checkbox_stair"), t("emoji_level_2"), t("methodology.mobility_table.stories.older.stairs")],
        [t("checkbox_uneven"), t("emoji_level_2"), t("methodology.mobility_table.stories.older.surfaces")],
        [t("checkbox_kerb"), t("emoji_level_3"), t("methodology.mobility_table.stories.older.high_kerbs")]
      ]
    }
  ];

  return (
    <div className={sty.methodologyLayout}>
      {/* Left navigation */}
      <aside className={sty.methodologyNav} aria-label={t("methodology.nav_aria")}>
        <div className={sty.methodologyNavInner}>
          <div className={sty.methodologyNavTitle}>{t("methodology.nav_title")}</div>
          <a href="#method-sec-1" className={sty.methodologyNavItem}>
            {t("methodology.nav_interface")}
          </a>
          <a href="#method-sec-2" className={sty.methodologyNavItem}>
            {t("methodology.nav_guidelines")}
          </a>
          <a href="#method-sec-3" className={sty.methodologyNavItem}>
            {t("methodology.nav_features")}
          </a>
          <a href="#method-sec-4" className={sty.methodologyNavItem}>
            {t("methodology.nav_research")}
          </a>
          <a href="#method-sec-5" className={sty.methodologyNavItem}>
            {t("methodology.nav_setup")}
          </a>
        </div>
      </aside>

      {/* main content */}
      <main className={sty.methodologyContent}>
        {/* Page title */}
        <section className={sty.toolDetailsSection}>
          <h1 className={sty.methodologyPageTitle}>
            {t("methodology.page_title")}
            <img
              src="/images/CAT_dark_Purple.png"
              alt="CAT"
              className={sty.methodologyLogo}
            /> 
          </h1>
        </section>

        {/* Section 1 */}
        <section
          id="method-sec-1"
          className={`${sty.toolDetailsSection} ${sty.methodologyAnchorSection}`}
        >
          <div className={sty.methodologySectionBlock}>
            <h2 className={sty.toolDetailsTitle}>
              {t("methodology.section1_title")}
            </h2>

            <div className={sty.methodologyThreeCol}>
              {/* Left column */}
              <div className={`${sty.methodologySideCol} ${sty.methodologyLeftCol}`}>
                <div className={`${sty.methodologyDescBox} ${sty.methodologyLeftBox1}`}> 
                  <div className={sty.methodologyDescText}>
                    {t("methodology.section1.box1_text")}
                  </div>
                </div>

                <div className={`${sty.methodologyDescBox} ${sty.methodologyLeftBox2}`}> 
                  <div className={sty.methodologyDescText}>
                    {t("methodology.section1.box2_text")}
                  </div>
                </div>

                <div className={`${sty.methodologyDescBox} ${sty.methodologyLeftBox3}`}> 
                  <div className={sty.methodologyDescText}>
                    {t("methodology.section1.box3_text")}
                  </div>
                </div>

                <div className={`${sty.methodologyDescBox} ${sty.methodologyLeftBox4}`}> 
                  <div className={sty.methodologyDescText}>
                    {t("methodology.section1.box4_text")}
                  </div>
                </div>

                <div className={`${sty.methodologyDescBox} ${sty.methodologyLeftBox5}`}> 
                  <div className={sty.methodologyDescText}>
                    {t("methodology.section1.box5_text")}
                  </div>
                </div>
              </div>

              {/* Center column */}
              <div className={sty.methodologyCenterCol}>
                <div className={`${sty.methodologyDescBox} ${sty.methodologyFloatingTopRightBox}`}> 
                  <div className={sty.methodologyDescText}>
                    {t("methodology.section1.box6_text")}
                  </div>
                </div>

                <div className={sty.methodologyMainImageWrap}>
                  <img
                    src="/images/method_map.png"
                    alt={t("methodology.section1.main_image_alt")}
                    className={sty.methodologyMainImage}
                  />
                </div>
              </div>

              {/* Right column */} 
              <div className={`${sty.methodologySideCol} ${sty.methodologyRightCol}`}> 

                <div className={`${sty.methodologyDescBox} ${sty.methodologyRightBox2}`}> 
                  <div className={sty.methodologyDescText}>
                    {t("methodology.section1.box7_text")}
                  </div>
                </div>

                <div className={`${sty.methodologyDescBox} ${sty.methodologyRightBox3}`}> 
                  <div className={sty.methodologyDescText}>
                    {t("methodology.section1.box8_text")}
                  </div>
                </div>

                <div className={`${sty.methodologyDescBox} ${sty.methodologyRightBox4}`}> 
                  <div className={sty.methodologyDescText}>
                    {t("methodology.section1.box9_text")}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* Section 2 + 3 */}
        <section
          id="method-sec-2"
          className={`${sty.toolDetailsSection} ${sty.methodologyAnchorSection}`}
        >
          <div className={sty.methodologyStepsSplit}>
            {/* Left column */}
            <div className={sty.methodologyStepsLeft}>
              <h1 className={`${sty.toolDetailsTitle} ${sty.stepBlock} ${sty.stepTitle3}`}>
                {t("methodology.section2_title")}
              </h1>

              <div className={`${sty.stepBlock} ${sty.step1}`}>
                <div className={sty.stickerCard}>
                  <h2 className={sty.toolDetailsTitle}>{t("methodology.step1_title")}</h2>
                  <div className={sty.toolDetailsText}>
                    <p>{t("methodology.step1_text")}</p>
                  </div>
                  <div className={sty.methodologyStepImageWrap}>
                    <img
                      src="/images/method_step1.png"
                      alt={t("methodology.step1_image_alt")}
                      className={sty.methodologyStepImage}
                    />
                  </div>
                </div>
              </div>

              <div className={`${sty.stepBlock} ${sty.step3}`}>
                <div className={sty.stickerCard}>
                  <h2 className={sty.toolDetailsTitle}>
                    {t("methodology.step3_title")}
                  </h2>
                  <div className={sty.toolDetailsText}>
                    <p>{t("methodology.step3_text")}</p>
                  </div>
                  <div className={sty.methodologyStepImageWrap}>
                    <img
                      src="/images/method_step3.png"
                      alt={t("methodology.step3_image_alt")}
                      className={sty.methodologyStepImage}
                    />
                  </div>
                </div>
              </div>

              <div className={`${sty.stepBlock} ${sty.step5}`}>
                <div className={`${sty.stickerCard} ${sty.stickerCardAlt}`}>
                  <h2 className={sty.toolDetailsTitle}>{t("methodology.step5_title")}</h2>
                  <div className={sty.toolDetailsText}>
                    <p>{t("methodology.step5_text")}</p>
                  </div>
                  <div className={sty.methodologyStepImageWrap}>
                    <img
                      src="/images/method_step5.png"
                      alt={t("methodology.step5_image_alt")}
                      className={sty.methodologyStepImage}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className={sty.methodologyStepsRight}>
              <div className={`${sty.methodologyOffsetCard} ${sty.stepBlock} ${sty.step2}`}>
                <div className={sty.stickerCard}>
                  <h2 className={sty.toolDetailsTitle}>{t("methodology.step2_title")}</h2>
                  <div className={sty.toolDetailsText}>
                    <p>{t("methodology.step2_text")}</p>
                  </div>
                  <div className={sty.methodologyStepImageWrap}>
                    <img
                      src="/images/method_step2.png"
                      alt={t("methodology.step2_image_alt")}
                      className={sty.methodologyStepImage}
                    />
                  </div>
                </div>
              </div>

              <section
                id="method-sec-3"
                className={`${sty.methodologySetupSection} ${sty.stepBlock} ${sty.step4Section}`}
              >
                <h1 className={sty.methodologySetupTitle}>
                  {t("methodology.section3_title")}
                </h1>

                <div className={`${sty.stickerCard} ${sty.stickerCardAlt}`}>
                  <h2 className={sty.toolDetailsTitle}> {t("methodology.step4_title")}</h2>
                  <div className={sty.toolDetailsText}>
                    <p>{t("methodology.step4_text")}</p>
                  </div>
                  <div className={sty.methodologyStepImageWrap}>
                    <img
                      src="/images/method_step4.png"
                      alt={t("methodology.step4_image_alt")}
                      className={sty.methodologyStepImage}
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>

        {/* Section 4 User Research*/}
        <section
          id="method-sec-4"
          className={`${sty.toolDetailsSection} ${sty.methodologyAnchorSection}`}
        >
          <h1 className={sty.toolDetailsTitle}>
            {t("methodology.section4_title")}
          </h1>

          <div className={sty.stickerCard}>
            <div className={sty.toolDetailsText}>
              <p>{t("methodology.section4_text")}</p>
              <h2 className={`${sty.toolDetailsTitle} ${sty.section4Subheading}`}>
                {t("methodology.section4_point1_title")}
              </h2>
              <p>
                <Trans
                  i18nKey="methodology.section4_point1_text"
                  t={t}
                  components={{
                    moreinfo: (
                      <a
                        className={sty.inlineLink}
                        href="https://www.smartmobilityhubs.eu/smarthubs-tool/accessibility-tool"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                  }}
                />
              </p>

              <h2 className={`${sty.toolDetailsTitle} ${sty.section4Subheading}`}>
                {t("methodology.section4_point2_title")}
              </h2>
              <p>{t("methodology.section4_point2_intro")}</p>
              <ul className={sty.section4BulletList}>
                <li>{t("methodology.section4_point2_bullet1")}</li>
                <li>{t("methodology.section4_point2_bullet2")}</li>
                <li>{t("methodology.section4_point2_bullet3")}</li>
              </ul>
              <p>{t("methodology.section4_point2_outro")}</p>

              <h2 className={`${sty.toolDetailsTitle} ${sty.section4Subheading}`}>
                {t("methodology.section4_point3_title")}
              </h2>
              <p>{t("methodology.section4_point3_intro")}</p>
              <ol className={sty.section4NumberedList}>
                <li>{t("methodology.section4_point3_item1")}</li>
                <li>{t("methodology.section4_point3_item2")}</li>
                <li>{t("methodology.section4_point3_item3")}</li>
              </ol>
              <p>{t("methodology.section4_point3_outro")}</p>

              <h2 className={`${sty.toolDetailsTitle} ${sty.section4Subheading}`}>
                {t("methodology.section4_point4_title")}
              </h2>
              <p>{t("methodology.section4_point4_text_1")}</p>
              <p>{t("methodology.section4_point4_text_2")}</p>
              <p>{t("methodology.section4_point4_text_3")}</p>

              <button
                type="button"
                className={sty.profileTableToggle}
                onClick={() => setShowMobilityTable((prev) => !prev)}
                aria-expanded={showMobilityTable}
                aria-controls="mobility-profiles-table"
              >
                {showMobilityTable
                  ? t("methodology.mobility_table.toggle_hide")
                  : t("methodology.mobility_table.toggle_show")}
              </button>

              {showMobilityTable && (
                <div id="mobility-profiles-table" className={sty.profileTableWrap}>
                  <table className={sty.profileTable}>
                    <thead>
                      <tr>
                        <th>{t("methodology.mobility_table.headers.feature")}</th>
                        <th>{t("methodology.mobility_table.headers.assessment")}</th>
                        <th>{t("methodology.mobility_table.headers.story")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mobilityProfilesTable.map((profile) => (
                        <React.Fragment key={profile.group}>
                          <tr className={sty.profileGroupRow}>
                            <td colSpan={3}>{profile.group}</td>
                          </tr>
                          {profile.rows.map(([feature, assessment, story]) => (
                            <tr key={`${profile.group}-${feature}`}>
                              <td>{feature}</td>
                              <td>{assessment}</td>
                              <td>{story}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h2 className={`${sty.toolDetailsTitle} ${sty.section4Subheading}`}>
                {t("methodology.section4_point5_title")}
              </h2>
              <p>
                <Trans
                  i18nKey="methodology.section4_point5_text"
                  t={t}
                  components={{
                    ref1: (
                      <a
                        className={sty.inlineLink}
                        href="https://doi.org/10.3389/fnagi.2023.1092990"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                    ref2: (
                      <a
                        className={sty.inlineLink}
                        href="https://doi.org/10.1016/j.gaitpost.2012.10.006"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                    ref3: (
                      <a
                        className={sty.inlineLink}
                        href="https://doi.org/10.3109/09638289709166526"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                    ref4: (
                      <a
                        className={sty.inlineLink}
                        href="https://doi.org/10.1016/j.buildenv.2008.11.008"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                    br: <br />
                  }}
                />
              </p>
            </div>
          </div> 
        </section>

        {/* Section 5 */}
        <section
          id="method-sec-5"
          className={`${sty.toolDetailsSection} ${sty.methodologyAnchorSection}`}
        >
          <h1 className={sty.toolDetailsTitle}>
            {t("methodology.section5_title")}
          </h1>

          <div className={sty.toolDetailsText}>
            <p>{t("methodology.section5_intro")}</p>
          </div>

          <div className={sty.toolDetailsGrid}>
            <div className={sty.stickerCard}>
              <h2 className={sty.toolDetailsTitle}>
                {t("methodology.section5_data_title")}
              </h2>
              <div className={sty.toolDetailsText}>
                <p>{t("methodology.section5_data_text")}</p>
              </div>
            </div>

            <div className={sty.stickerCard}>
              <h2 className={sty.toolDetailsTitle}>
                {t("methodology.section5_management_title")}
              </h2>
              <div className={sty.toolDetailsText}>
                <p>
                  <Trans
                    i18nKey="methodology.section5_management_text"
                    t={t}
                    components={{
                      github: (
                        <a
                          href="https://github.com/tum-ustp/InclusiveSpacesCAT"
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      ),
                    }}
                  />
                </p>
              </div>
            </div>
          </div>
        </section>


      </main>
      
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
                  <span className={sty.contactName}>{t("landing_contact_rita")}</span>
                  <a className={sty.contactEmail} href="mailto:margarita.zykova@tum.de">
                    margarita.zykova@tum.de
                  </a>
                </div>

                <div className={sty.contactPastTitle}>{t("landing_contact_past_members")}</div>

                <div className={sty.contactLine}>
                  <span className={sty.contactName}>{t("landing_contact_huashu")}</span>
                  <a className={sty.contactEmail} href="mailto:huashu.zhan@tum.de">
                    huashu.zhan@tum.de
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
