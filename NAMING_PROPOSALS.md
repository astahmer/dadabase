# Relationship Panel Naming Proposals

## Current Issue

The relationships panel has two distinct filtering behaviors that are confusingly labeled:

### Current Behavior (labeled as "References")
When you select a row in `purchase_projects` with `id = b07a3629-4f85-48fc-bc24-6ce0745e4c06`:
- **What it shows**: All rows from `purchase_projects` where `initiated_by_id = e80c7b5e-258f-40f5-a1d3-a7a3cb6eced6` (matching the FK value of the current row)
- **Problem**: Shows rows from the SAME table, filtered by the FK column value

### Desired Behavior (needs implementation)
When you select a row in `purchase_projects` with `id = b07a3629-4f85-48fc-bc24-6ce0745e4c06`:
- **What it should show**: The row from `userIdentities` where `id = e80c7b5e-258f-40f5-a1d3-a7a3cb6eced6` (the target of the FK)
- **Purpose**: Show the related row from the referenced table using the FK value as a filter

### Referenced By (Already Correct)
The "Referenced By" section already works correctly - it shows rows from OTHER tables that reference the current row's primary key.

---

## Naming Proposals

### Option 1: "Outbound" vs "Relationships"
- **Current "References" → "Outbound Filter"** or **"Filtered Rows"**
  - Shows rows from the same/other tables matching the FK column value
  - Semantic: "outbound" suggests data flowing outward by a FK column

- **New Feature → "Relationships"** or **"Related Records"**
  - Shows the actual referenced row(s) by following the FK to the target table
  - Semantic: "relationships" suggests following the actual relationship definition

**Pros**: Clear distinction between filtering behavior and relationship following
**Cons**: "Outbound" might be confusing if not familiar with data direction

---

### Option 2: "By Column Filter" vs "Through Foreign Key"
- **Current "References" → "By Column Value"** or **"Column Filter"**
  - Shows rows where a column equals a specific value
  - Semantic: Describes the filter mechanism

- **New Feature → "Through Foreign Key"** or **"Follow FK"**
  - Shows the row(s) pointed to by the foreign key
  - Semantic: Describes the relationship mechanism

**Pros**: Explicitly describes the mechanism in each label
**Cons**: Wordy, may be too technical

---

### Option 3: "Same Table Rows" vs "Related Record"
- **Current "References" → "Other Rows with Same FK Value"** or **"Same-Column Rows"**
  - Shows rows (from any table with that column) matching the FK column value
  - Semantic: Describes what is being shown

- **New Feature → "Related Record"** or **"FK Target"**
  - Shows the record pointed to by the FK
  - Semantic: Descriptive of the relationship direction

**Pros**: Very explicit about what data is shown
**Cons**: Labels are quite long

---

### Option 4 (RECOMMENDED): "Reverse Lookup" vs "Direct Link"
- **Current "References" → "Reverse Lookup"**
  - Shows rows where they HAVE this column value (inverse filter)
  - Semantic: Looking backward from a column value to find matching rows

- **New Feature → "Direct Link"** or **"Related Data"**
  - Shows the row(s) that this FK points to (forward follow)
  - Semantic: Following the relationship direction

**Pros**:
- Clear directional language (reverse vs direct)
- Short and memorable
- Professional terminology
- Aligns with database concepts (reverse FK lookup)

**Cons**: Requires understanding of "reverse" concept

---

### Option 5 (ALTERNATIVE): "Same-Value Rows" vs "Following Relationships"
- **Current "References" → "Find by Value"**
  - Shows rows with matching FK column values
  - Semantic: Finding rows that match a value

- **New Feature → "Follow Relationships"**
  - Shows the related record via FK relationship
  - Semantic: Traversing the relationship structure

**Pros**:
- Very intuitive - "Follow" is action-oriented
- Distinguishes between searching and traversing

**Cons**: First label might still be ambiguous

---

## Visual Representation

```
Current Row: purchase_projects (id = b07a3629...)
  └─ initiated_by_id: e80c7b5e...

"Referenced By" (Already correct - KEEP)
  └─ Shows rows from activity_rooms.purchase_project_id = b07a3629...

"References" (Current - NEEDS RENAME)
  └─ Shows rows from purchase_projects where initiated_by_id = e80c7b5e...
  └─ [Following FK column filtering logic]

"Related Data" (New - TO IMPLEMENT)
  └─ Shows row from userIdentities where id = e80c7b5e...
  └─ [Following the FK relationship to its target]
```

---

## Recommendation

**Use Option 4: "Reverse Lookup" / "Direct Link"**

### Reasoning:
1. **Technical accuracy**: "Reverse lookup" is database terminology for finding rows that match a FK value
2. **Directional clarity**: Immediately communicates the direction (reverse vs direct/forward)
3. **Conciseness**: Two simple words, easy to scan
4. **Learning curve**: Users quickly understand the difference
5. **Consistency**: Aligns with database design patterns and tools

### Implementation Names:
- Group heading: `"Reverse Lookup"` (for current References behavior)
- Group heading: `"Direct Link"` or `"Related Data"` (for new feature)
- Alternative: `"Following Relationships"` (for new feature, more descriptive)

### Label Color Coding (Optional Enhancement):
- Reverse Lookup: Orange/Amber icon (suggests indirect/derived)
- Direct Link: Green icon (suggests direct/natural relationship)
- Referenced By: Already has its own color

---

## Implementation Checklist

- [ ] Rename "References" to "Reverse Lookup" in `RelationshipsPanel`
- [ ] Implement new "Direct Link" / "Related Data" feature
- [ ] Update TypeScript interfaces if needed
- [ ] Add documentation about new relationship types
- [ ] Update UI labels and help text
- [ ] Consider adding tooltips explaining each type
