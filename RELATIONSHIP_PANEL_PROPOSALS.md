# Relationship Panel Navigation Improvements

## Problem
When selecting multiple relationships, the panel becomes crowded with stacked cards, making it hard to navigate and see all the data clearly.

---

## Proposal 1: Collapsed Cards by Default

**Concept:** Cards show only headers by default (cardinality + row count), expand individually on click

```
┌─ Click to hide relations for: public.workflows = 7cb70406-725f-447f-9067-c6443636d842  ─┐
│                                                                                       [✕]  │
├─ Show: [workflows.created_by_id › useridentities.id ▼]  (3 selected)                     │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                            │
│ ▶ form_templates.workflow_id › workflows.id                         [1:N]  [1 row] [⋯]   │
│                                                                                            │
│ ▼ workflow_drafts.workflow_id › workflows.id                         [1:N]  [1 row] [⋯]  │
│  ├─ Column Headers: id, created_at, updated_at, name, organization_id, workflow_id ...   │
│  ├─────────────────────────────────────────────────────────────────────────────────────  │
│  │ e2a940a9-7de5-4ae... | Thu Sep 18 2025 1... | ... | Test | ebc7bf77-87ce-493... │    │
│  ├─────────────────────────────────────────────────────────────────────────────────────  │
│  └─ [Full Screen] ↗                                                                      │
│                                                                                            │
│ ▶ workflow_executions.workflow_id › workflows.id                    [1:N]  [─] [⋯]       │
│                                                                                            │
│ ▼ workflow_logical_blocks.workflow_id › workflows.id                [1:N]  [1 row] [⋯]  │
│  ├─ Column Headers: id, created_at, updated_at, name, deleted_at, workflow_id ...       │
│  ├─────────────────────────────────────────────────────────────────────────────────────  │
│  │ 89c92b7a-ec7e-49e... | Thu Sep 18 2025 1... | ... | Yes | [object Object] | ...  │    │
│  ├─────────────────────────────────────────────────────────────────────────────────────  │
│  └─ [Full Screen] ↗                                                                      │
│                                                                                            │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Interaction Flow
1. User sees all selected relationships as compact headers
2. Click ▶ chevron to expand a card and see its data
3. Click ▼ chevron to collapse it again
4. Only one card typically expanded at a time (user preference)
5. Use dropdown to add/remove relationships

### Pros ✅
- **Very compact** - All relationships visible at a glance as 1-line headers
- **Clean hierarchy** - Clear visual distinction between collapsed/expanded states
- **Quick scanning** - See row counts and cardinality for all at once
- **Smart defaults** - Headers show just enough info (relationship name + 1:N + count)
- **Familiar pattern** - Like file explorer collapse/expand

### Cons ❌
- Requires clicking to see data (one extra interaction)
- Less like "dashboard" view

---

## Proposal 2: Tabbed View

**Concept:** Relationship cards shown as tabs, one visible at a time, but dropdown shows which ones are selected

```
┌─ Click to hide relations for: public.workflows = 7cb70406-725f-447f-9067-c6443636d842  ─┐
│                                                                                       [✕]  │
├─ Show: [workflows.created_by_id › useridentities.id ▼]  (3 selected)                     │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                            │
│  [form_templates] [workflow_drafts] [workflow_executions] [workflow_logical_blocks]      │
│  ├─────────────────────────────────────────────────────────────────────────────────────  │
│  │ form_templates.workflow_id › workflows.id                [1:N]  [1 row]  [Full Screen] │
│  │                                                                              [✕]       │
│  ├─────────────────────────────────────────────────────────────────────────────────────  │
│  │ Column Headers: id, created_at, updated_at, deleted_at, name, description, ...       │
│  ├─────────────────────────────────────────────────────────────────────────────────────  │
│  │ 89c92b7a-ec7e-49e... | Thu Sep 18 2025 1... | Thu Sep 18 2025 1... | - | Test | Yes │  │
│  ├─────────────────────────────────────────────────────────────────────────────────────  │
│  └─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                            │
└──────────────────────────────────────────────────────────────────────────────────────────┘

           Click a tab to switch ↓

┌─ Click to hide relations for: public.workflows = 7cb70406-725f-447f-9067-c6443636d842  ─┐
│                                                                                       [✕]  │
├─ Show: [workflows.created_by_id › useridentities.id ▼]  (3 selected)                     │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                            │
│  [form_templates] [workflow_drafts] [workflow_executions] [workflow_logical_blocks]      │
│  ├─────────────────────────────────────────────────────────────────────────────────────  │
│  │ workflow_logical_blocks.workflow_id › workflows.id       [1:N]  [1 row]  [Full Screen] │
│  │                                                                              [✕]       │
│  ├─────────────────────────────────────────────────────────────────────────────────────  │
│  │ Column Headers: id, created_at, updated_at, name, deleted_at, workflow_id, schema ... │
│  ├─────────────────────────────────────────────────────────────────────────────────────  │
│  │ 89c92b7a-ec7e-49e... | Thu Sep 18 2025 1... | Thu Sep 18 2025 1... | Test | [object]... │
│  ├─────────────────────────────────────────────────────────────────────────────────────  │
│  └─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                            │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Interaction Flow
1. User sees tabs with shortened names (table names or abbreviations)
2. Active tab shows full relationship data
3. Click other tabs to switch relationships instantly
4. X button on tab to remove it from view
5. Dropdown to add more relationships
6. Arrow buttons (‹ ›) to navigate between tabs (optional)

### Pros ✅
- **Maximum space** - Full table data for the active relationship
- **Clean switching** - Tab navigation feels like a native app
- **Always one focused** - No crowding, always clear which one you're viewing
- **Visual indicator** - Tab styling shows which relationships are selected
- **Familiar UX** - Tabs are everywhere (browser tabs, settings, etc.)

### Cons ❌
- Need to switch tabs to compare relationships
- Tab bar gets crowded if many relationships selected (though can use scrolling/arrows)

---

## Comparison Matrix

| Feature | Proposal 1 (Collapsed) | Proposal 2 (Tabs) |
|---------|----------------------|------------------|
| **Space Efficiency** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Very Good |
| **See All At Once** | ⭐⭐⭐⭐⭐ All headers visible | ⭐⭐ One tab visible |
| **Data Viewing** | ⭐⭐⭐ Expand on demand | ⭐⭐⭐⭐⭐ Full table always |
| **Switching Relationships** | ⭐⭐⭐ Click chevron | ⭐⭐⭐⭐⭐ Click tab |
| **Complexity** | ⭐⭐⭐⭐ Simple | ⭐⭐⭐ Medium |
| **Comparing Relationships** | ⭐⭐ Hard | ⭐⭐⭐ Moderate |
| **Add/Remove** | ⭐⭐⭐⭐ Dropdown works great | ⭐⭐⭐⭐ Dropdown + tab close |
| **Mobile Friendly** | ⭐⭐⭐⭐⭐ Very | ⭐⭐⭐ Good |
| **Implementation Effort** | ⭐⭐⭐ Medium | ⭐⭐⭐⭐ Higher |

---

## Recommendation

**🏆 Proposal 1 (Collapsed Cards)** seems better for this use case because:
- Ultra-compact by default, only takes space you need
- You can see metadata (counts, cardinality) for ALL relationships instantly
- Most databases don't need to compare multiple relationships at once
- Simpler to implement
- Better for small screens/mobile

**But if you prefer full table viewing:** Proposal 2 (Tabs) shines with maximum space for data and native-app feel.

Which resonates with you more?
