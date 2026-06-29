import { YouTubePreview } from "./YouTubePreview";
import styles from "./VideosSection.module.css";
import { useTranslation } from "next-i18next";

export function VideosSection() {
    const { t } = useTranslation("common");

    const videos = [
        {
            title: t("videos_video_1_title"),
            youtubeUrl: "https://www.youtube.com/watch?v=Cs5_lzD_e5E",
        },
        {
            title: t("videos_video_2_title"),
            youtubeUrl: "https://www.youtube.com/watch?v=C6O0UYzsUHo ",
        },
    ];

    return (
        <section
            className={styles.section}
            aria-labelledby="cat-videos-title"
            aria-label={t("videos_section_aria_label")}
        >
            <h2 id="cat-videos-title" className={styles.title}>
                {t("videos_section_title")}
            </h2>

            <p className={styles.subtitle}>
                {t("videos_section_subtitle")}
            </p>

            <div className={styles.grid}>
                {videos.map((video) => (
                    <article key={video.youtubeUrl} className={styles.card}>
                        <h3 className={styles.cardTitle}>{video.title}</h3>

                        <YouTubePreview
                            title={video.title}
                            youtubeUrl={video.youtubeUrl}
                            thumbnailUrl={video.thumbnailUrl}
                            playButtonLabel={t("videos_play_button_label", {
                                title: video.title,
                            })}
                        />
                    </article>
                ))}
            </div>
        </section>
    );
}
