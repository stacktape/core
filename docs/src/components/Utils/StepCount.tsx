import { colors, typographyCss } from '@/styles/variables';
import { merge } from 'lodash';

export function StepCount({ count, rootCss }: { count: number; rootCss?: Css }) {
  return (
    <span
      css={merge(
        {
          borderRadius: '50%',
          height: '28px',
          width: '28px',
          border: `2px solid ${colors.fontColorPrimary}`
        },
        rootCss || {}
      )}
    >
      <span
        css={{
          ...typographyCss,
          textAlign: 'center',
          verticalAlign: 'middle',
          lineHeight: '28px',
          height: '28px',
          width: '28px',
          margin: '0 auto',
          fontSize: '14px',
          marginLeft: '-2.25px',
          marginTop: '-1px',
          fontWeight: 'normal',
          display: 'inline-block'
        }}
      >
        {count}
      </span>
    </span>
  );
}
