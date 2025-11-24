import { useEffect, useRef, useState } from "react";
import { Popover, Portal } from "@ark-ui/react";
import { Code as CodeIcon } from "lucide-react";
import { InlineJsonPopover } from "./inline-json-popover";
import { Button } from "../ui/button.tsx";
import { HStack } from "../ui/layout.tsx";

interface InlineJsonButtonProps {
	value: unknown;
	onOpenDialog?: () => void;
	children: React.ReactNode;
}

export function InlineJsonButton({
	value,
	onOpenDialog,
	children,
}: InlineJsonButtonProps) {
	const [isOpen, setIsOpen] = useState(false);
	const divRef = useRef<HTMLDivElement>(null);
	const mousePositionRef = useRef({ x: 0, y: 0 });
	const isModifierPressedRef = useRef(false);

	const updateDataAttribute = () => {
		if (!divRef.current) return;

		// Use parent's bounding box to avoid overflow issues
		const parentRect = divRef.current.parentElement?.getBoundingClientRect();
		if (!parentRect) return;

		const { x, y } = mousePositionRef.current;
		const isMouseOver =
			x >= parentRect.left &&
			x <= parentRect.right &&
			y >= parentRect.top &&
			y <= parentRect.bottom;

		if (isMouseOver && isModifierPressedRef.current) {
			divRef.current.dataset.cmdHover = "true";
		} else {
			delete divRef.current.dataset.cmdHover;
		}
	};

	useEffect(() => {
		const trackMouse = (e: MouseEvent) => {
			mousePositionRef.current = { x: e.clientX, y: e.clientY };
			updateDataAttribute();
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			isModifierPressedRef.current = e.ctrlKey || e.metaKey;
			updateDataAttribute();
		};

		const handleKeyUp = () => {
			isModifierPressedRef.current = false;
			if (divRef.current) {
				delete divRef.current.dataset.cmdHover;
			}
		};

		window.addEventListener("mousemove", trackMouse);
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		return () => {
			window.removeEventListener("mousemove", trackMouse);
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, []);

	return (
		<Popover.Root
			lazyMount
			open={isOpen}
			onOpenChange={(details) => setIsOpen(details.open)}
		>
			<HStack gap="1" align="center" className="group">
				<Popover.Trigger
					className="focus-visible:ring-2 focus-visible:ring-ring rounded p-0.5"
					title="Open quick preview (⌘ click on Mac, Ctrl click on Windows)"
					aria-label="Open quick preview"
					asChild
				>
					<Button variant="ghost" size="xs" className="px-1">
						<CodeIcon className="h-4 w-4 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300" />
					</Button>
				</Popover.Trigger>
				<div
					ref={divRef}
					onClick={(e) => {
						if (e.ctrlKey || e.metaKey) {
							setIsOpen(true);
						}
					}}
					className="group"
					title="Open quick preview (⌘ click on Mac, Ctrl click on Windows)"
				>
					{children}
				</div>
			</HStack>

			<Portal>
				<Popover.Positioner>
					<Popover.Content className="z-50">
						<InlineJsonPopover
							value={value}
							onExpandToDialog={() => {
								setIsOpen(false);
								onOpenDialog?.();
							}}
							onClose={() => setIsOpen(false)}
						/>
					</Popover.Content>
				</Popover.Positioner>
			</Portal>
		</Popover.Root>
	);
}
