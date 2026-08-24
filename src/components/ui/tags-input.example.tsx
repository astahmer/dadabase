import { useState } from "react";

import {
  TagsInput,
  TagsInputControl,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemPreview,
  TagsInputItemText,
  TagsInputLabel,
} from "#src/components/ui/tags-input.tsx";

export function TagsInputExample() {
  const [tags, setTags] = useState(["react", "typescript"]);

  return (
    <div className="w-full max-w-sm">
      <TagsInput value={tags} onValueChange={(details) => setTags(details.value)}>
        <TagsInputLabel>Tags</TagsInputLabel>
        <TagsInputControl>
          {tags.map((tag, index) => (
            <TagsInputItem key={tag} value={tag} index={index}>
              <TagsInputItemPreview>
                <TagsInputItemText>{tag}</TagsInputItemText>
              </TagsInputItemPreview>
            </TagsInputItem>
          ))}
        </TagsInputControl>
        <TagsInputInput placeholder="Add tag..." />
      </TagsInput>
    </div>
  );
}
