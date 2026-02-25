import {
  Accordion,
  AccordionItem,
  AccordionItemContent,
  AccordionItemTrigger,
} from "#src/components/ui/accordion.tsx";

import { Stack } from "./layout.tsx";

export function AccordionExample() {
  const items = [
    {
      id: "item-1",
      title: "Section 1",
      content: "This is the content for the first accordion section.",
    },
    {
      id: "item-2",
      title: "Section 2",
      content: "This is the content for the second accordion section. It can contain more details.",
    },
    {
      id: "item-3",
      title: "Section 3",
      content:
        "This is the content for the third accordion section. You can expand multiple sections or just one.",
    },
  ];

  return (
    <Stack>
      <Accordion defaultValue={["item-1"]}>
        {items.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionItemTrigger>{item.title}</AccordionItemTrigger>
            <AccordionItemContent>{item.content}</AccordionItemContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Stack>
  );
}
