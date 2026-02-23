import { Stack } from "#src/components/ui/layout.tsx";
import { ListboxMenuExample } from "#src/components/ui/listbox-menu.example.tsx";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sandbox")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Stack w="full" h="full" align="center" justify="center">
			<ListboxMenuExample />
		</Stack>
	);
}
