/* eslint-disable @typescript-eslint/ban-ts-comment */
import Tippy, { TippyProps } from '@tippyjs/react';
import { ReactNode } from 'react';
import { merge } from 'lodash';
import { boxShadowDark, border, colors } from '../../styles/variables';
import QuestionMark from '../../../icons/question-mark.svg';
import 'tippy.js/dist/tippy.css';
import Image from 'next/image';
import { typographyCss } from '@/styles/global';

export const tippyTooltipStyle: Css = {
  '.tippy-content': {
    background: `${colors.backgroundColor} !important`,
    borderRadius: '6px !important',
    '*': {
      fontSize: '0.85rem'
    },
    p: {
      lineHeight: 1.5
    },
    a: {
      fontWeight: 'bold',
      lineHeight: 1.5
    },
    code: {
      color: '#b7b7b7',
      border: '1px solid #b7b7b7',
      borderRadius: '4px',
      padding: '0px 3px'
    },
    hr: {
      margin: '4px 0px'
    },
    ul: {
      marginBottom: '10px',
      paddingLeft: '15px'
    },
    wordBreak: 'normal'
  },
  '.tippy-box': {
    backgroundColor: colors.backgroundColor,
    outline: `1px solid ${colors.borderColor} !important`,
    boxShadow: boxShadowDark,
    borderRadius: '6px !important',
    '&[data-placement^="bottom"] > .tippy-arrow::before': {
      border: `${border} !important`,
      top: '-8px !important',
      left: '-4px !important',
      width: '12px !important',
      height: '12px !important',
      transform: 'rotate(45deg) !important',
      background: colors.backgroundColor
    },
    '&[data-placement^="right"] > .tippy-arrow::before': {
      border: `${border} !important`,
      top: '7px !important',
      left: '-8px !important',
      width: '12px !important',
      height: '12px !important',
      transform: 'rotate(45deg) !important',
      background: colors.backgroundColor
    },
    '&[data-placement^="left"] > .tippy-arrow::before': {
      border: `${border} !important`,
      top: '-3px !important',
      left: '8px !important',
      width: '12px !important',
      height: '12px !important',
      transform: 'rotate(45deg) !important',
      background: colors.backgroundColor
    },
    '&[data-placement^="top"] > .tippy-arrow::before': {
      border: `${border} !important`,
      left: '5px !important',
      width: '12px !important',
      height: '12px !important',
      transform: 'rotate(45deg) !important',
      background: colors.backgroundColor
    }
  }
};

export function TooltipNew({
  size,
  triggerCss,
  ...props
}: {
  size?: number;
  placement?: TippyProps['placement'];
  tooltipText: ReactNode;
  tooltipWidth?: Css['width'];
  triggerCss?: Css;
  headline?: string;
  trigger?: 'click' | 'hover';
}) {
  return (
    <WithTooltip {...props}>
      <Image
        height={size || 20}
        width={size || 20}
        css={merge(
          {
            marginBottom: '-4px',
            cursor: props.trigger === 'click' ? 'pointer' : 'default',
            position: 'relative'
          },
          triggerCss
        )}
        src={QuestionMark}
        alt="question-mark"
      />
    </WithTooltip>
  );
}

export function WithTooltip({
  placement,
  tooltipText,
  tooltipWidth,
  trigger = 'hover',
  children
}: {
  placement?: TippyProps['placement'];
  tooltipText: ReactNode;
  tooltipWidth?: Css['width'];
  trigger?: 'click' | 'hover';
  children: ReactNode;
}) {
  return (
    <Tippy
      placement={placement || 'auto'}
      // animation={false}
      interactive
      animation={false}
      delay={0}
      arrow
      zIndex={10002}
      maxWidth={500}
      // appendTo={document.body}
      offset={[0, 14]}
      // appendTo={document.body}
      trigger={trigger === 'hover' ? 'mouseenter focus' : 'click'}
      {...(trigger === 'hover' && {
        interactive: true
      })}
      content={
        <div
          css={{
            ...typographyCss,
            ...(tooltipWidth && { width: tooltipWidth }),
            textAlign: 'left',
            padding: '5px 10px 5px 10px',
            p: {
              marginBottom: '10px',
              textAlign: 'left'
            },
            'p:last-child': {
              marginBottom: '0px'
            }
          }}
        >
          {tooltipText}
        </div>
      }
    >
      {/* @ts-ignore */}
      {children}
    </Tippy>
  );
}
