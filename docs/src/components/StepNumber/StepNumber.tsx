import { merge } from 'lodash';
import { boxShadowDark, colors, onMaxW570, typographyCss } from '../../styles/variables';

function StepNumber({ num, rootCss, numberCss }: { num: number; rootCss?: Css; numberCss?: Css }) {
  const padding = {
    1: '4px 10px',
    2: '4px 7px 4px 9px',
    3: '4px 7px 4px 9px',
    4: '3px 7px 4px 8px',
    5: '3px 7px 4px 8px'
  }[num];
  return (
    <div css={merge({}, rootCss)}>
      <span
        css={merge(
          {
            ...typographyCss,
            border: '3px solid #1fa9a8',
            fontWeight: 900,
            fontSize: '19px',
            color: '#1fa9a8',
            borderRadius: '50%',
            marginRight: '11px',
            padding,
            width: '17px',
            height: '17px',
            textAlign: 'center',
            boxShadow: boxShadowDark,
            background: colors.elementBackground,
            zIndex: 2,
            [onMaxW570]: {
              // display: 'none',
              marginRight: '0px'
            }
          },
          numberCss || {}
        )}
      >
        {num}.
      </span>
    </div>
  );
}

export default StepNumber;
