import { colors, onMaxW1200 } from '@/styles/variables';
import { FaArrowRight } from 'react-icons/fa';

export function ListItemPoint({ text, rootCss, iconCss }: { text: ReactNode; rootCss?: Css; iconCss?: Css }) {
  return (
    <p
      css={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        justifyContent: 'flex-start',
        textAlign: 'left',
        marginBottom: '7px',
        fontSize: '1rem',
        lineHeight: 1.7,
        [onMaxW1200]: {
          fontSize: '0.925rem'
        },
        // [onMaxW1150]: {
        //   fontSize: '0.95rem'
        // }
        ...rootCss
      }}
    >
      <FaArrowRight
        size={13}
        css={{ color: colors.fontColorSecondary, flexShrink: 0, marginTop: '7.5px', ...iconCss }}
      />
      <span css={{ marginLeft: '5px' }}>{text}</span>
    </p>
  );
}
