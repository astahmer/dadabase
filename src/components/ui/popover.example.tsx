import { Button } from "#src/components/ui/button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "#src/components/ui/popover.tsx";

export function PopoverExample() {
  return (
    <div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Open Popover</Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-2">
            <h4 className="leading-none font-medium">Popover Content</h4>
            <p className="text-muted-foreground text-sm">
              This is a popover example with some content inside.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
