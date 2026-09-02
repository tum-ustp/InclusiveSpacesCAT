import '@/styles/globals.css'
import { PlasmicRootProvider } from "@plasmicapp/react-web";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Head from "next/head";
import Link from "next/link";
import { appWithTranslation } from "next-i18next";

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>CAT – Comfort-based Accessibility Tool</title>
        <link rel="icon" type="image/png" href="/favicon.png" />

        {/* SEO and mobile support */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Explore comfort-based accessibility maps for inclusive urban design." />
      </Head>

      <PlasmicRootProvider Head={Head} Link={Link}>
        <Component {...pageProps} />
        <Analytics />
        <SpeedInsights />
      </PlasmicRootProvider>
    </>
  );
}

export default appWithTranslation(MyApp);
