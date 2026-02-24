import { createListCollection, type SelectRootProps } from "@ark-ui/react";

import { Field } from "../form/field.tsx";
import { HStack } from "../ui/layout.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueText,
} from "../ui/select.tsx";

const limitPerPage = createListCollection({
  items: [
    { label: "25", value: "25" },
    { label: "50", value: "50" },
    { label: "100", value: "100" },
    { label: "250", value: "250" },
    { label: "500", value: "500" },
  ],
});

export const PageLimitSelect = ({
  portalled,
  ...props
}: Omit<SelectRootProps<any>, "collection"> & {
  portalled?: boolean;
}) => {
  return (
    <HStack className="mr-4 font-medium">
      <Field label="Limit" className="w-auto" />
      <Select className="w-[100px]" {...props} collection={limitPerPage}>
        <SelectTrigger>
          <SelectValueText />
        </SelectTrigger>
        <SelectContent>
          {limitPerPage.items.map((item) => (
            <SelectItem item={item} key={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </HStack>
  );
};
