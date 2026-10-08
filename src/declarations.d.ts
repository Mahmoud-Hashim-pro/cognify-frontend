import 'react-aria-components';

declare module 'react-aria-components' {
  export interface RadioGroupProps {
    value?: string;
    defaultValue?: string;
    onChange?: (value: any) => void;
    orientation?: 'horizontal' | 'vertical' | string;
    isDisabled?: boolean;
    isReadOnly?: boolean;
    isRequired?: boolean;
    isInvalid?: boolean;
  }
}

declare module 'react-aria-components/RadioGroup' {
  import React from 'react';
  export interface RadioGroupProps {
    children?: React.ReactNode;
    value?: string;
    defaultValue?: string;
    onChange?: (value: any) => void;
    orientation?: 'horizontal' | 'vertical' | string;
    className?: string | ((values: any) => string);
    'aria-label'?: string;
    'aria-labelledby'?: string;
    isDisabled?: boolean;
    isReadOnly?: boolean;
    isRequired?: boolean;
    isInvalid?: boolean;
  }
  export interface RadioProps {
    children?: React.ReactNode | ((values: { isSelected: boolean; isFocused: boolean; isFocusVisible: boolean; isDisabled: boolean; isHovered: boolean; isPressed: boolean }) => React.ReactNode);
    value: string;
    className?: string | ((values: { isSelected: boolean; isFocused: boolean; isFocusVisible: boolean; isDisabled: boolean; isHovered: boolean; isPressed: boolean }) => string);
    isDisabled?: boolean;
    autoFocus?: boolean;
  }
  export const RadioGroup: React.FC<RadioGroupProps>;
  export const Radio: React.FC<RadioProps>;
}

declare module 'react-aria-components/Button' {
  import React from 'react';
  export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    onPress?: (e: any) => void;
    isDisabled?: boolean;
    className?: string | ((values: any) => string);
  }
  export const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;
}
