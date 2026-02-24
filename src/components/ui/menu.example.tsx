import { Button } from "#src/components/ui/button.tsx";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuItemGroup,
	MenuItemGroupLabel,
	MenuSeparator,
	MenuShortcut,
	MenuTrigger,
} from "#src/components/ui/menu.tsx";

export function MenuExample() {
	return (
		<div>
			<Menu>
				<MenuTrigger asChild>
					<Button variant="outline">Open Menu</Button>
				</MenuTrigger>
				<MenuContent>
					<MenuItemGroup>
						<MenuItemGroupLabel>Account</MenuItemGroupLabel>
						<MenuItem value="profile">Profile</MenuItem>
						<MenuItem value="settings">Settings</MenuItem>
					</MenuItemGroup>
					<MenuSeparator />
					<MenuItem value="share">
						Share
						<MenuShortcut>⌘S</MenuShortcut>
					</MenuItem>
					<MenuSeparator />
					<MenuItem value="logout">
						Logout
						<MenuShortcut>⌘Q</MenuShortcut>
					</MenuItem>
				</MenuContent>
			</Menu>
		</div>
	);
}
