import { HoverCard, HoverCardContent, HoverCardTrigger } from "#src/components/ui/hovercard.tsx";

export function HoverCardExample() {
  return (
    <div>
      <HoverCard>
        <HoverCardTrigger asChild>
          <button className="text-sm font-medium hover:underline">@radix_ui</button>
        </HoverCardTrigger>
        <HoverCardContent className="w-80">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">@radix_ui</h4>
            <p className="text-muted-foreground text-sm">
              A collection of accessible UI component libraries.
            </p>
            <div className="flex items-center pt-2">
              <span className="text-muted-foreground text-xs">Joined December 2021</span>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
