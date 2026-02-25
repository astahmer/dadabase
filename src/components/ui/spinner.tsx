import type { VariantProps } from "class-variance-authority";

import type { ExposedComponentProps } from "./component-props.ts";

import { spinnerRecipe } from "./spinner.styles";

type SpinnerVariants = VariantProps<typeof spinnerRecipe>;

interface SpinnerProps extends ExposedComponentProps<"div"> {
  size?: SpinnerVariants["size"];
  colorPalette?: SpinnerVariants["colorPalette"];
  label?: string;
  className?: string;
}

export const Spinner = ({
  label = "Loading...",
  size = "md",
  colorPalette = "primary",
  className,
  ...rest
}: SpinnerProps) => {
  return (
    <div {...rest} className={spinnerRecipe({ size, colorPalette, className })}>
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
};

export { spinnerRecipe };
