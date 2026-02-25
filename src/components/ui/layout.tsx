import { cn } from "#src/lib/utils.ts";
import type { VariantProps } from "class-variance-authority";

import type { ExposedComponentProps } from "./component-props.ts";

import { stack } from "./layout.styles";

export const Stack = (props: ExposedComponentProps<"div"> & VariantProps<typeof stack>) => {
  const { className, align, justify, wrap, w, h, gap, direction, ...rest } = props;
  return (
    <div
      {...rest}
      className={cn(
        stack({
          direction: direction ?? "col",
          align,
          justify,
          wrap,
          w,
          h,
          gap,
        }),
        className,
      )}
    />
  );
};
export const HStack = (props: ExposedComponentProps<"div"> & VariantProps<typeof stack>) => {
  const { className, align, justify, wrap, w, h, gap, direction, ...rest } = props;
  return (
    <div
      {...rest}
      className={cn(
        stack({
          direction: direction ?? "row",
          align,
          justify,
          wrap,
          w,
          h,
          gap,
        }),
        className,
      )}
    />
  );
};

export const FullCenter = (props: ExposedComponentProps<"div">) => {
  return (
    <div
      {...props}
      className={cn("flex h-full flex-col items-center justify-center", props.className)}
    />
  );
};

export { stack };
