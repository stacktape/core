import { ChevronRight } from 'react-feather';
import { onMaxW500 } from '../../../_old/src/styles/responsive';
import { colors } from '../../../_old/src/styles/variables';

type Card = { title: string; content: string; href: string };

const NavigationCard = ({ card }: { card: Card }) => {
  return (
    <a
      href={card.href}
      css={{
        cursor: 'pointer',
        MozBoxAlign: 'center',
        MozBoxDirection: 'normal',
        MozBoxOrient: 'horizontal',
        display: 'flex',
        marginTop: '10px',
        padding: '5px',
        position: 'relative',
        alignItems: 'center',
        placeSelf: 'stretch',
        color: colors.font,
        backgroundColor: colors.background,
        borderRadius: '6px',
        border: `2px solid ${colors.border}`,
        boxShadow: `${colors.shadow} 0 3px 8px`,
        textDecoration: 'none',
        '&:hover': {
          color: colors.primary,
          textDecoration: 'none',
          border: `2px solid ${colors.primary}`,
          'svg *': {
            stroke: colors.primary
          }
        }
      }}
    >
      <div css={{ width: '85%' }}>
        <div
          css={{
            display: 'block',
            margin: '0',
            padding: '9px 13px',
            // textDecoration: 'underline',
            fontSize: '21px',
            lineHeight: 1.75,
            fontWeight: 500,
            [onMaxW500]: {
              fontSize: '16px',
              padding: '7px 11px',
              lineHeight: 1.4
            }
          }}
        >
          {card.title}
        </div>
        <div
          css={{
            display: 'block',
            margin: '0',
            padding: '11px',
            color: '#b2b2b2',
            fontSize: '15px',
            lineHeight: 1.75,
            fontWeight: 400,
            [onMaxW500]: {
              fontSize: '13.5px',
              padding: '7px'
            }
          }}
        >
          {card.content}
        </div>
      </div>
      <div css={{ width: '15%' }}>
        <ChevronRight size="28px" width="100%" />
      </div>
    </a>
  );
};

const NavigationCards = ({ cards }: { cards: Card[] }) => {
  return (
    <div
      css={{
        marginTop: '40px',
        padding: '0',
        width: 'auto',
        display: 'grid',
        gridTemplateRows: 'auto',
        columnGap: '24px',
        gridTemplateColumns: 'calc(50% - 12px) calc(50% - 12px)'
      }}
    >
      {cards.map((card) => (
        <NavigationCard card={card} />
      ))}
    </div>
  );
};

export default NavigationCards;
