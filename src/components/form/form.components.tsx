import { useStore } from "@tanstack/react-form";
import { cva, type VariantProps } from "class-variance-authority";

import { Button } from "../ui/button.tsx";
import { Input } from "../ui/input.tsx";
import { Label } from "../ui/label.tsx";
import { Stack } from "../ui/layout.tsx";
import * as ArkSelect from "../ui/select.tsx";
import { Switch as ArkSwitch } from "../ui/switch.tsx";
import { Textarea as ArkTextarea } from "../ui/textarea.tsx";
import { useFieldContext, useFormContext } from "./form.context.ts";

const labelVariants = cva("", {
  variants: {
    size: {
      sm: "text-xs",
      md: "text-sm",
      lg: "text-base font-semibold",
      xl: "text-lg",
    },
  },
  defaultVariants: {
    size: "lg",
  },
});

export function SubscribeButton({ label }: { label: string }) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button type="submit" disabled={isSubmitting}>
          {label}
        </Button>
      )}
    </form.Subscribe>
  );
}

function ErrorMessages({ errors }: { errors: Array<string | { message: string }> }) {
  return (
    <>
      {errors.map((error) => (
        <div
          key={typeof error === "string" ? error : error.message}
          className="mt-1 font-bold text-red-500"
        >
          {typeof error === "string" ? error : error.message}
        </div>
      ))}
    </>
  );
}

export function TextField({
  label,
  placeholder,
  type,
  labelSize = "md",
}: {
  label: string;
  placeholder?: string;
  type?: "number" | "password" | "text";
  labelSize?: VariantProps<typeof labelVariants>["size"];
}) {
  const field = useFieldContext<string | number>();
  const errors = useStore(field.store, (state) => state.meta.errors);

  return (
    <div>
      {label && (
        <Label htmlFor={label} className={`mb-2 ${labelVariants({ size: labelSize })}`}>
          {label}
        </Label>
      )}
      <Input
        id={label}
        type={type}
        value={field.state.value}
        placeholder={placeholder}
        onBlur={field.handleBlur}
        onChange={(e) =>
          field.handleChange(type === "number" ? e.target.valueAsNumber : e.target.value)
        }
      />
      {field.state.meta.isTouched && <ErrorMessages errors={errors} />}
    </div>
  );
}

export function TextArea({ label, rows = 3 }: { label: string; rows?: number }) {
  const field = useFieldContext<string>();
  const errors = useStore(field.store, (state) => state.meta.errors);

  return (
    <div>
      <Label htmlFor={label} className="mb-2 text-xl font-bold">
        {label}
      </Label>
      <ArkTextarea
        id={label}
        value={field.state.value}
        onBlur={field.handleBlur}
        rows={rows}
        onChange={(e) => field.handleChange(e.target.value)}
      />
      {field.state.meta.isTouched && <ErrorMessages errors={errors} />}
    </div>
  );
}

export function Select(props: {
  label: string;
  options: Array<{ label: string; value: string }>;
  defaultValue?: string[];
  placeholder?: string;
  multiple?: boolean;
}) {
  const field = useFieldContext<string | string[]>();
  const errors = useStore(field.store, (state) => state.meta.errors);

  const collection = ArkSelect.createListCollection({ items: props.options });

  return (
    <Stack>
      <ArkSelect.Select
        className="w-full min-w-64"
        defaultValue={props.defaultValue}
        collection={collection}
        positioning={{ sameWidth: true }}
        onValueChange={(details) =>
          field.handleChange(props.multiple ? details.value : details.value.at(0)!)
        }
        multiple={props.multiple}
      >
        <ArkSelect.SelectLabel>{props.label}</ArkSelect.SelectLabel>
        <ArkSelect.SelectControl>
          <ArkSelect.SelectTrigger>
            <ArkSelect.SelectValueText placeholder={props.placeholder} />
            <ArkSelect.SelectIndicator />
          </ArkSelect.SelectTrigger>
        </ArkSelect.SelectControl>
        <ArkSelect.SelectContent>
          {collection.items.map((item) => (
            <ArkSelect.SelectItem key={item.value} item={item}>
              {item.label}
            </ArkSelect.SelectItem>
          ))}
        </ArkSelect.SelectContent>
      </ArkSelect.Select>
      {field.state.meta.isTouched && <ErrorMessages errors={errors} />}
    </Stack>
  );
}

export function Switch({ label }: { label: string }) {
  const field = useFieldContext<boolean>();
  const errors = useStore(field.store, (state) => state.meta.errors);

  return (
    <div>
      <div className="flex items-center gap-2">
        <ArkSwitch
          id={label}
          onBlur={field.handleBlur}
          checked={field.state.value}
          onCheckedChange={(details) => field.handleChange(details.checked)}
        />
        <Label htmlFor={label}>{label}</Label>
      </div>
      {field.state.meta.isTouched && <ErrorMessages errors={errors} />}
    </div>
  );
}
