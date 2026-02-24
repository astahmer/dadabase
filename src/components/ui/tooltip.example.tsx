import { Button } from "#src/components/ui/button.tsx";
import { Tooltip } from "#src/components/ui/tooltip.tsx";
import { Stack } from "./layout.tsx";

export function TooltipExample() {
	return (
		<Stack>
			<div className="flex flex-wrap gap-3">
				<Tooltip content="This is a tooltip" colorPalette="inverted">
					<Button variant="outline">Hover me (Inverted)</Button>
				</Tooltip>

				<Tooltip content="This is a tooltip" colorPalette="default">
					<Button variant="outline">Hover me (Default)</Button>
				</Tooltip>

				<Tooltip content="Show arrow" showArrow colorPalette="inverted">
					<Button variant="outline">Hover me (With Arrow)</Button>
				</Tooltip>

				<Tooltip content="" disabled>
					<Button variant="outline" disabled>
						Disabled Tooltip
					</Button>
				</Tooltip>

				<Tooltip
					content={
						<div className="space-y-2">
							<p className="font-semibold">Rich Content</p>
							<p className="text-xs">Tooltips can contain rich content</p>
						</div>
					}
					colorPalette="inverted"
				>
					<Button variant="outline">Rich Content</Button>
				</Tooltip>
			</div>
		</Stack>
	);
}
