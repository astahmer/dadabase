import { useState } from "react";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "#src/components/ui/tabs.tsx";
import { Stack } from "./layout.tsx";

export function TabsExample() {
	const [value, setValue] = useState("tab-1");

	const tabs = [
		{
			id: "tab-1",
			label: "Profile",
			content: "This is the profile tab content.",
		},
		{
			id: "tab-2",
			label: "Settings",
			content: "This is the settings tab content.",
		},
		{
			id: "tab-3",
			label: "Notifications",
			content: "This is the notifications tab content.",
		},
	];

	return (
		<Stack>
			<Tabs value={value} onValueChange={(details) => setValue(details.value)}>
				<TabsList>
					{tabs.map((tab) => (
						<TabsTrigger key={tab.id} value={tab.id}>
							{tab.label}
						</TabsTrigger>
					))}
				</TabsList>
				{tabs.map((tab) => (
					<TabsContent key={tab.id} value={tab.id}>
						<div className="p-4 border rounded-md">{tab.content}</div>
					</TabsContent>
				))}
			</Tabs>
		</Stack>
	);
}
