import Head from 'next/head';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import { useEffect } from 'react';
import { getCalApi } from '@calcom/embed-react';

export const geistFont = Geist({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700']
});

export const geistMonoFont = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700']
});

const CRISP_ID = '1d26554b-8e37-4cb0-8c95-e774099f4b74';

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    (async function () {
      const cal = await getCalApi();
      cal('init', {});
    })();
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Script id="crisp" strategy="afterInteractive">
        {`
          window.$crisp = [];
          window.CRISP_WEBSITE_ID = ${JSON.stringify(CRISP_ID)};
          (function() {
            var d = document;
            var s = d.createElement("script");
            s.src = "https://client.crisp.chat/l.js";
            s.async = true;
            d.getElementsByTagName("head")[0].appendChild(s);
          })();
        `}
      </Script>
      <Component className={[geistFont.className, geistMonoFont.className]} {...pageProps} />
    </>
  );
}
