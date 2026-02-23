import { ComboboxExample } from "#src/components/ui/combobox.example.tsx";
import { Stack } from "#src/components/ui/layout.tsx";
import { ListboxMenuExample } from "#src/components/ui/listbox-menu.example.tsx";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sandbox")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="grid grid-cols-2 gap-6 p-6 w-full h-full">
			<Stack>
				<h4 className="text-lg font-semibold">Listbox Menu</h4>
				<ListboxMenuExample />
			</Stack>
			<Stack>
				<h4 className="text-lg font-semibold">Combobox</h4>
				<ComboboxExample />
			</Stack>
		</div>
	);
}
