import { Field as ArkField } from "@ark-ui/react";

import type { ExposedComponentProps } from "../ui/component-props.ts";

import { Label } from "../ui/label.tsx";

export interface FieldProps
  extends Omit<ArkField.RootBaseProps, "label">, ExposedComponentProps<"div"> {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  errorText?: React.ReactNode;
  asterisk?: boolean;
}

export const Field = (props: FieldProps) => {
  const { label, children, helperText, errorText, asterisk, ...rest } = props;
  return (
    <ArkField.Root {...rest}>
      {label && (
        <Label className="w-full">
          {label} {asterisk && <ArkField.RequiredIndicator />}
        </Label>
      )}
      {children}
      {helperText && <ArkField.HelperText>{helperText}</ArkField.HelperText>}
      {errorText && <ArkField.ErrorText>{errorText}</ArkField.ErrorText>}
    </ArkField.Root>
  );
};
