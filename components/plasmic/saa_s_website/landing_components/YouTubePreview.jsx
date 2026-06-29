import { useState } from "react";
import styles from "./YouTubePreview.module.css";

function getYouTubeVideoId(youtubeUrl) {
    try {
        const url = new URL(youtubeUrl);

        if (url.hostname.includes("youtu.be")) {
            return url.pathname.replace("/", "");
        }

        if (url.searchParams.has("v")) {
            return url.searchParams.get("v");
        }

        if (url.pathname.includes("/embed/")) {
            return url.pathname.split("/embed/")[1];
        }

        if (url.pathname.includes("/shorts/")) {
            return url.pathname.split("/shorts/")[1];
        }

        return "";
    } catch {
        return "";
    }
}

export function YouTubePreview({ youtubeUrl, thumbnailUrl, title, playButtonLabel }) {
    const [isLoaded, setIsLoaded] = useState(false);

    const videoId = getYouTubeVideoId(youtubeUrl);
    const defaultThumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const previewImageUrl = thumbnailUrl || defaultThumbnailUrl;

    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;

    return (
        <div className={styles.preview}>
            {isLoaded ? (
                <iframe
                    className={styles.iframe}
                    src={embedUrl}
                    title={title}
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                />
            ) : (
                <button
                    type="button"
                    className={styles.button}
                    onClick={() => setIsLoaded(true)}
                    aria-label={playButtonLabel || `Video abspielen: ${title}`}
                >
                    <img
                        className={styles.image}
                        src={previewImageUrl}
                        alt=""
                        loading="lazy"
                    />

                    <span className={styles.playIcon} aria-hidden="true" />
                </button>
            )}
        </div>
    );
}
