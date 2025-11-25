/** @jsx jsx */
import { jsx } from '@emotion/react';
import { useCallback, useEffect, useState } from 'react';
import Logo from '../../../static/assets/logo.svg';
import cookies from 'js-cookie';
import { Link } from '../Link/Link';
import { boxShadow, colors, shadows } from '../../../_old/src/styles/variables';
import { X } from 'react-feather';
import { IconButton } from '../Buttons/IconButton';
import { SolidGradientButton } from '../Buttons/SolidGradientButton';
import { onMaxW500 } from '../../../_old/src/styles/responsive';

let isConsentGiven = false;

const COOKIE_NAME = 'stp_cookie_constent_given';

const setConsentsForAnalytics = () => {
  const setClarityConsentFn = (window as any).clarity;
  // const matomo = (window as any)._paq;
  if (setClarityConsentFn) {
    setClarityConsentFn('consent');
  }
  // if (matomo) {
  //   matomo.push(['rememberCookieConsentGiven']);
  // }
};

const CookieConsentBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const handleConsent = useCallback((event) => {
    isConsentGiven = true;
    cookies.set(COOKIE_NAME, 'true', { domain: 'stacktape.com', sameSite: 'Strict', expires: 365 });
    setConsentsForAnalytics();
    if (!(event.type === 'scroll')) {
      setIsVisible(false);
    }
    window.removeEventListener('scroll', handleConsent);
  }, []);

  useEffect(() => {
    isConsentGiven = process.env.IS_DEV ? true : !!cookies.get(COOKIE_NAME);
    if (!isConsentGiven) {
      setIsVisible(!isConsentGiven);
      window.addEventListener('scroll', handleConsent);
      return () => {
        window.removeEventListener('scroll', handleConsent);
      };
    }
  }, []);

  if (!isVisible) {
    return null;
  }
  return (
    <div
      css={{
        height: 'auto',
        position: 'fixed',
        bottom: '0',
        left: '0',
        backgroundColor: colors.background,
        boxShadow,
        zIndex: 49,
        minWidth: '300px',
        maxWidth: '615px',
        [onMaxW500]: {
          width: '100%'
        }
      }}
    >
      <div
        css={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '0 auto',
          padding: '13px',
          position: 'relative'
        }}
      >
        <span css={{ position: 'absolute', top: '10px', right: '10px' }}>
          <IconButton
            type="submit"
            background={colors.background}
            hoverStroke={colors.primary}
            stroke={colors.font}
            icon={X}
            onClick={handleConsent}
          />
        </span>
        <div css={{ display: 'flex', alignItems: 'center', flexDirection: 'row', padding: '0px 10px' }}>
          <img
            css={{
              height: '50px',
              marginRight: '20px',
              [onMaxW500]: {
                display: 'none'
              }
            }}
            src={Logo}
            alt="logo"
          />
          <p css={{ a: { lineHeight: 'unset' }, fontSize: '14px', lineHeight: '16px', color: colors.font }}>
            We use cookies to recognize your repeated visits and to analyze the website traffic. We <b>DO NOT</b> use
            them for targeted advertisment. To learn more about how we use cookies, please refer to our{' '}
            <Link to="https://stacktape.com/privacy-policy">
              <span css={{ fontSize: '12px', fontWeight: 'bold' }}>Cookie policy</span>
            </Link>
            . By clicking &quot;Accept&quot;, &quot;X&quot; or using this site, you consent to the use of cookies
            (unless you have disabled them).
          </p>
        </div>
        <SolidGradientButton
          rootCss={{ marginLeft: '25px', marginTop: '45px', height: 'auto', padding: '10px 15px' }}
          text="Accept"
          type="submit"
          onClick={handleConsent}
        />
      </div>
    </div>
  );
};

export default CookieConsentBanner;
