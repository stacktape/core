import { merge } from 'lodash';
import { ReactElement, useRef, useEffect } from 'react';
import QuestionMark from '../../../static/random-icons/question-mark.svg';
import { onMaxW870 } from '../../../_old/src/styles/responsive';
import { boxShadow, colors, typographyCss } from '../../../_old/src/styles/variables';

function InfoTooltip({
  tooltipText,
  rootCss,
  size = 20
}: {
  tooltipText: string | ReactElement;
  rootCss?: Css;
  size?: number;
}) {
  const tooltipBlockRef = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>;

  useEffect(() => {
    const windowWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    if (tooltipBlockRef.current) {
      const position = tooltipBlockRef.current.getBoundingClientRect();
      if (position.left + position.width > windowWidth - 320) {
        if (position.left - position.width < 0) {
          tooltipBlockRef.current.style.width = '400px';
          const marginFromRight = 10;
          tooltipBlockRef.current.style.left = `-${position.left + 320 + marginFromRight - windowWidth}px`;
        } else {
          tooltipBlockRef.current.style.left = 'auto';
          tooltipBlockRef.current.style.right = '0';
        }
      }
      if (window.scrollY + position.top + position.height > document.documentElement.scrollHeight) {
        tooltipBlockRef.current.style.top = 'auto';
        tooltipBlockRef.current.style.bottom = '15px';
      }
    }
  });

  return (
    <span
      css={merge(
        {
          cursor: 'pointer',
          position: 'relative',
          '&:hover': { '& .tooltip-block': { visibility: 'visible' } }
        },
        rootCss
      )}
    >
      <img
        css={{
          height: `${size}px`,
          width: `${size}px`,
          marginBottom: '-4px',
          [onMaxW870]: {
            height: '15px',
            width: '15px'
          }
        }}
        src={QuestionMark}
        alt="question-mark"
      />
      <span
        css={{
          visibility: 'hidden',
          position: 'absolute',
          top: '25px',
          left: '0px',
          width: '400px',
          background: colors.background,
          boxShadow,
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000000000000
        }}
        className="tooltip-block"
        ref={tooltipBlockRef}
      >
        <span css={{ padding: '15px 30px', ...typographyCss }}>{tooltipText}</span>
      </span>
    </span>
  );
}

export default InfoTooltip;
