import { GoogleAnalytics, GoogleTagManager } from "@next/third-parties/google"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

import { GA_ID, GTM_ID } from "@/lib/config"

/** Consent Mode v2 defaults must be set before any Google tag loads. */
const CONSENT_DEFAULT = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;
var c=null;try{c=localStorage.getItem('hmo_consent')}catch(e){}
gtag('consent','default',{analytics_storage:c==='granted'?'granted':'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',wait_for_update:500});`

export function AnalyticsScripts() {
  return (
    <>
      {(GA_ID || GTM_ID) && <script dangerouslySetInnerHTML={{ __html: CONSENT_DEFAULT }} />}
      {GTM_ID && <GoogleTagManager gtmId={GTM_ID} />}
      {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
      <Analytics />
      <SpeedInsights />
    </>
  )
}
