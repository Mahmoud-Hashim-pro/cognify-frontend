import React from 'react';
import { Button as ReactAriaButton, type ButtonProps as ReactAriaButtonProps } from 'react-aria-components';
import { cn } from '../../lib/utils';

export interface AriaButtonProps extends ReactAriaButtonProps {
  className?: string;
}

/**
 * Shared, accessible button built on Adobe React Aria's headless <Button>.
 *
 * Why this wrapper exists instead of every screen importing
 * `Button as AriaButton` from 'react-aria-components' directly:
 * - Guarantees a visible, WCAG 2.2-compliant focus ring (`data-focus-visible`)
 *   on every button in the app, even ones a future screen forgets to style.
 * - Centralizes the pressed/disabled/hover treatment so it can't drift
 *   between Login.tsx, DisabilityModeView.tsx, and any screen added later.
 * - Callers still fully control appearance via `className` (merged, not
 *   replaced, using `cn()` / tailwind-merge) and all React Aria press/keyboard
 *   behavior (`onPress`, `isDisabled`, roving focus, etc.) passes straight
 *   through untouched.
 *
 * Usage is a drop-in replacement for the old local alias:
 *   import { AriaButton } from './ui/AriaButton';
 *   <AriaButton onPress={...} className="...">...</AriaButton>
 */
export const AriaButton = React.forwardRef<HTMLButtonElement, AriaButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <ReactAriaButton
        ref={ref}
        {...props}
        className={(renderProps) =>
          cn(
            // Baseline focus-visible ring so keyboard/screen-reader users always
            // get a visible indicator, even if a caller's className omits one.
            'outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-cyan-400 data-[focus-visible]:ring-offset-2 data-[focus-visible]:ring-offset-slate-950',
            'data-[pressed]:scale-[0.98] transition-transform',
            'data-[disabled]:opacity-60 data-[disabled]:cursor-not-allowed',
            typeof className === 'function'
              ? (className as (props: typeof renderProps) => string)(renderProps)
              : className
          )
        }
      />
    );
  }
);

AriaButton.displayName = 'AriaButton';

export default AriaButton;
