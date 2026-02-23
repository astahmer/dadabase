import { AccordionExample } from "#src/components/ui/accordion.example.tsx";
import { BadgeExample } from "#src/components/ui/badge.example.tsx";
import { BreadcrumbExample } from "#src/components/ui/breadcrumb.example.tsx";
import { ButtonExample } from "#src/components/ui/button.example.tsx";
import { CardExample } from "#src/components/ui/card.example.tsx";
import { CheckboxExample } from "#src/components/ui/checkbox.example.tsx";
import { ComboboxExample } from "#src/components/ui/combobox.example.tsx";
import { DialogExample } from "#src/components/ui/dialog.example.tsx";
import { InputExample } from "#src/components/ui/input.example.tsx";
import { Stack } from "#src/components/ui/layout.tsx";
import { ListboxMenuExample } from "#src/components/ui/listbox-menu.example.tsx";
import { PaginationExample } from "#src/components/ui/pagination.example.tsx";
import { SelectExample } from "#src/components/ui/select.example.tsx";
import { SpinnerExample } from "#src/components/ui/spinner.example.tsx";
import { SwitchExample } from "#src/components/ui/switch.example.tsx";
import { TabsExample } from "#src/components/ui/tabs.example.tsx";
import { TextareaExample } from "#src/components/ui/textarea.example.tsx";
import { TooltipExample } from "#src/components/ui/tooltip.example.tsx";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sandbox")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="grid grid-cols-2 gap-6 p-6 w-full h-full overflow-auto">
			<Stack>
				<h4 className="text-lg font-semibold">Accordion</h4>
				<AccordionExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Badge</h4>
				<BadgeExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Breadcrumb</h4>
				<BreadcrumbExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Button</h4>
				<ButtonExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Card</h4>
				<CardExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Checkbox</h4>
				<CheckboxExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Combobox</h4>
				<ComboboxExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Dialog</h4>
				<DialogExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Input</h4>
				<InputExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Listbox Menu</h4>
				<ListboxMenuExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Pagination</h4>
				<PaginationExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Select</h4>
				<SelectExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Spinner</h4>
				<SpinnerExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Switch</h4>
				<SwitchExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Tabs</h4>
				<TabsExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Textarea</h4>
				<TextareaExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Tooltip</h4>
				<TooltipExample />
			</Stack>
		</div>
	);
}
