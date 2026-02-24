import { Kbd } from "#src/components/ui/kbd.tsx";

export function KbdExample() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div>
        <Kbd>⌘K</Kbd>
      </div>
      <div>
        <Kbd variant="outline">Ctrl</Kbd>
      </div>
      <div>
        <Kbd size="sm">Esc</Kbd>
      </div>
      <div>
        <Kbd variant="subtle" size="lg">
          Tab
        </Kbd>
      </div>
    </div>
  );
}
