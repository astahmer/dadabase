import { Button } from "#src/components/ui/button.tsx";
import { toaster } from "#src/components/ui/toaster.tsx";

export function ToastExample() {
  return (
    <div>
      <Button
        variant="outline"
        onClick={() => {
          toaster.create({
            title: "Scheduled: Catch up",
            description: "Friday, February 10, 2024 at 4:57 PM",
            type: "info",
          });
        }}
      >
        Show Toast
      </Button>
    </div>
  );
}
