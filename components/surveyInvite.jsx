import { useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import sty from "./MapComponent.module.css";

const SURVEY_URLS = {
  hamburg: "https://form.typeform.com/to/SjBF2goT",
  penteli: "https://form.typeform.com/to/EEYJNGJM"
};

const SURVEY_INVITE_ENABLED = true;

export default function SurveyInvite({ city, trigger }) {
  const { t } = useTranslation("common");
  const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);
  const surveyPromptShownRef = useRef(false);
  const surveyLinkRef = useRef(null);

  const surveyPromptUrl = SURVEY_URLS[city] || "";
  const canShowSurveyPrompt = Boolean(surveyPromptUrl);

  const closeSurveyPrompt = () => {
    setShowSurveyPrompt(false);
  };

  useEffect(() => {
    if (!trigger || surveyPromptShownRef.current || !canShowSurveyPrompt) {
      return;
    }

    surveyPromptShownRef.current = true;
    setShowSurveyPrompt(true);
  }, [trigger, canShowSurveyPrompt]);

  useEffect(() => {
    if (!showSurveyPrompt) return;

    requestAnimationFrame(() => {
      surveyLinkRef.current?.focus();
    });

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSurveyPrompt();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [showSurveyPrompt]);

  if (!SURVEY_INVITE_ENABLED || !canShowSurveyPrompt) {
    return null;
  }

  return (
    <>
      {showSurveyPrompt && (
        <div
          className={sty.surveyOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="survey-prompt-title"
          onClick={closeSurveyPrompt}
        >
          <div
            className={sty.surveyDialog}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={sty.surveyCloseButton}
              aria-label={t("modal_close")}
              onClick={closeSurveyPrompt}
            >
              {"\u00d7"}
            </button>
            <h2 id="survey-prompt-title" className={sty.surveyTitle}>
              {t("survey_prompt_title")}
            </h2>
            <p className={sty.surveyText}>
              <strong>{t("survey_prompt_question")}</strong>
              <br />
              {t("survey_prompt_body")}
            </p>
            <p className={sty.surveyLinkIntro}>
              {t("survey_prompt_link_intro")}
            </p>
            <a
              ref={surveyLinkRef}
              className={sty.surveyLink}
              href={surveyPromptUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {surveyPromptUrl}
            </a>
          </div>
        </div>
      )}

      {!showSurveyPrompt && surveyPromptShownRef.current && (
        <button
          type="button"
          className={sty.surveyReopenButton}
          onClick={() => setShowSurveyPrompt(true)}
          aria-haspopup="dialog"
          aria-controls="survey-prompt-title"
        >
          {t("survey_prompt_reopen")}
        </button>
      )}
    </>
  );
}
