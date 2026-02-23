import { useState } from "react";
import {
	Switch,
	SwitchControl,
	SwitchLabel,
} from "#src/components/ui/switch.tsx";
import { Stack } from "./layout.tsx";

export function SwitchExample() {
	const [toggles, setToggles] = useState<Record<string, boolean>>({
		notifications: true,
		darkMode: false,
		autoSave: true,
		analytics: false,
	});

	const options = [
		{ id: "notifications", label: "Enable Notifications" },
		{ id: "darkMode", label: "Dark Mode" },
		{ id: "autoSave", label: "Auto Save" },
		{ id: "analytics", label: "Share Analytics" },
	];

	return (
		<Stack>
			<div className="space-y-3">
				{options.map((option) => (
					<Switch
						key={option.id}
						checked={toggles[option.id]}
						onCheckedChange={(details) =>
							setToggles((prev) => ({
								...prev,
								[option.id]: details.checked,
							}))
						}
					>
						<SwitchControl />
						<SwitchLabel>{option.label}</SwitchLabel>
					</Switch>
				))}
			</div>

			<div className="rounded-md bg-accent p-3 text-sm">
				<p className="font-medium">Enabled toggles:</p>
				<p className="text-muted-foreground">
					{Object.entries(toggles)
						.filter(([, isEnabled]) => isEnabled)
						.map(([id]) => id)
						.join(", ") || "None"}
				</p>
			</div>

			<Switch disabled>
				<SwitchControl />
				<SwitchLabel>Disabled switch</SwitchLabel>
			</Switch>
		</Stack>
	);
}
