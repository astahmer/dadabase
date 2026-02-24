import { AlertDialog } from "#src/components/ui/alert-dialog.tsx";
import { Button } from "#src/components/ui/button.tsx";

export function AlertDialogExample() {
	return (
		<div>
			<AlertDialog
				trigger={<Button variant="destructive">Delete Account</Button>}
				title="Delete Account"
				description="Are you sure you want to delete your account? This action cannot be undone."
				onConfirm={() => console.log("Confirmed")}
				onCancel={() => console.log("Cancelled")}
			/>
		</div>
	);
}
