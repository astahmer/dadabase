# Relationships Panel UI Proposals

## Context
- Currently viewing: `public.workflows` row with ID `a268ac39-dd85-4c67-a8ce-991931888d54`
- This row has multiple incoming and outgoing relationships

---

## Proposal 1: Tabs Layout (RECOMMENDED)

```
┌─ public.workflows = a268ac39-dd85-4c67-a8ce-991931888d54 ─────────────────── ✕
├─ [References ↗] [Referenced By ←]
│
├─ References (Outgoing) - Tables this row points to:
│  ├─ [→] workflows_executions          1:N    5 rows    ⤢
│  ├─ [→] workflow_drafts               1:1    1 row     ⤢
│  ├─ [→] workflow_revisions            1:N    3 rows    ⤢
│  └─ [→] form_templates                N:M    8 rows    ⤢
│
│     (When you click one):
│     ┌─ workflow_executions (5 related rows) ───────────────────┐
│     │ execution_id │ status  │ created_at   │ workflow_id │ ... │
│     ├──────────────┼─────────┼──────────────┼─────────────┼─────┤
│     │ exec-1234    │ running │ 2025-01-15   │ a268ac39... │ ... │
│     │ exec-5678    │ success │ 2025-01-14   │ a268ac39... │ ... │
│     │ exec-9012    │ failed  │ 2025-01-13   │ a268ac39... │ ... │
│     └─ [View All in Full Screen] ⤢                                │
│     └─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Clean tab navigation at the top
- Click any relationship to view its data
- One relationship expanded at a time
- Full width for the table data
- Maximize button opens full-screen sheet

**Visual Hierarchy:**
```
Header (collapse/close buttons)
├─ Tabs: [References] [Referenced By]
├─ List of relationships (table name, cardinality, count)
│  └─ Selected relationship expands to show table
└─ Table data with pagination
```

---

## Proposal 2: Quick Preview Cards

```
┌─ public.workflows = a268ac39-dd85-4c67-a8ce-991931888d54 ────────── ✕
│
├─ OUTGOING RELATIONSHIPS (What this row references):
│
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────┐
│ │ workflows_executions │ │  workflow_drafts     │ │  workflow... │
│ │ 1:N  (5 rows)        │ │  1:1  (1 row)        │ │  1:N  (3..) │
│ ├──────────────────────┤ ├──────────────────────┤ ├──────────────┤
│ │ ID  │ Status  │ ...  │ │ ID  │ Name  │ ...   │ │ ID  │ Name..│
│ ├─────┼─────────┼──────┤ ├─────┼───────┼───────┤ ├─────┼───────┤
│ │e001 │running  │ ...  │ │w001 │Draft1 │ ...   │ │w_r_1│Rev... │
│ │e002 │success  │ ...  │ │     │       │       │ │w_r_2│Rev... │
│ │e003 │failed   │ ...  │ │     │       │       │ │w_r_3│Rev... │
│ ├─────────────────────────────────────────────────────────────────┤
│ │[View All ⤢]          │ │[View All ⤢]        │ │[View All ⤢]  │
│ └──────────────────────┘ └──────────────────────┘ └──────────────┘
│
│ ≡ Scroll for more relationships →
│
└─ INCOMING RELATIONSHIPS (What references this row):
│
│ ┌──────────────────────┐ ┌──────────────────────┐
│ │ workflow_executions  │ │  form_submissions    │
│ │ N:1  (12 rows)       │ │  M:N  (24 rows)      │
│ ├──────────────────────┤ ├──────────────────────┤
│ │ ID  │ Status  │ ...  │ │ ID  │ User  │ ...   │
│ ├─────┼─────────┼──────┤ ├─────┼───────┼───────┤
│ │e001 │running  │ ...  │ │s001 │user@… │ ...   │
│ │e002 │success  │ ...  │ │s002 │user@… │ ...   │
│ │e003 │failed   │ ...  │ │s003 │user@… │ ...   │
│ ├─────────────────────────────────────────────┤
│ │[View All ⤢]          │ │[View All ⤢]        │
│ └──────────────────────┘ └──────────────────────┘
│
└─────────────────────────────────────────────────────────────────────
```

**Key Features:**
- All relationships visible at once as cards
- Each card shows a 3-row preview
- Cards are scrollable horizontally
- Sections for Outgoing/Incoming keep things organized
- Click "View All" to open full sheet

**Visual Hierarchy:**
```
Header
├─ Section: Outgoing Relationships
│  └─ Cards: [relationship data preview] [relationship...] [...]
├─ Section: Incoming Relationships
│  └─ Cards: [relationship data preview] [relationship...]
└─ Footer (scrollable indicators)
```

---

## Proposal 3: Side-by-Side Navigation

```
┌─ public.workflows = a268ac39-dd85-4c67-a8ce-991931888d54 ────────────────────── ✕
├────────────────────────────────────┬─────────────────────────────────────────────┤
│  RELATIONSHIPS                      │  PREVIEW: workflows_executions (5 rows)     │
│                                    │                                              │
│  Outgoing ↗                        │  id           │ status  │ created_at         │
│  ├─ workflows_executions   (5)  ◀──┼──────────────┼─────────┼────────────────────┤
│  ├─ workflow_drafts         (1)    │  exec-1234   │ running │ 2025-01-15 14:23   │
│  ├─ workflow_revisions      (3)    │  exec-5678   │ success │ 2025-01-14 09:15   │
│  └─ form_templates          (8)    │  exec-9012   │ failed  │ 2025-01-13 16:42   │
│                                    │  ...                                         │
│  Incoming ←                        │  [View All in Fullscreen ⤢]                 │
│  ├─ form_submissions        (12)   │                                              │
│  ├─ workflow_executions     (24)   │                                              │
│  └─ audit_logs              (145)  │                                              │
│                                    │                                              │
│  [1:N indicator] [count]           │  Pagination: Page 1 of 2                    │
│  Cardinality shown on hover        │                                              │
│                                    │                                              │
└────────────────────────────────────┴─────────────────────────────────────────────┘
```

**Key Features:**
- Left sidebar: List of all relationships (compact, scrollable)
- Right side: Full table view of selected relationship
- No toggling - just click to switch
- Shows cardinality and count on hover
- Most desktop-like experience
- Table takes full width

**Visual Hierarchy:**
```
Header
├─ Left Column (1/3 width):
│  ├─ Outgoing relationships (clickable list)
│  └─ Incoming relationships (clickable list)
└─ Right Column (2/3 width):
   └─ Table data with full pagination
```

---

## Proposal 4: Flat Expandable List (Simple)

```
┌─ public.workflows = a268ac39-dd85-4c67-a8ce-991931888d54 ──────────── ✕
│
├─ workflow_executions → workflows.id
│  1:N   5 related rows                                          [⤢ View Full]
│  ┌───────────────────────────────────────────────────────────────────┐
│  │ execution_id │ status  │ created_at   │ updated_at   │ ...        │
│  ├──────────────┼─────────┼──────────────┼──────────────┼────────────┤
│  │ exec-1234    │ running │ 2025-01-15   │ 2025-01-15   │ ...        │
│  │ exec-5678    │ success │ 2025-01-14   │ 2025-01-14   │ ...        │
│  │ exec-9012    │ failed  │ 2025-01-13   │ 2025-01-13   │ ...        │
│  └───────────────────────────────────────────────────────────────────┘
│
├─ workflow_drafts → workflows.id
│  1:1   1 related row                                            [⤢ View Full]
│  ┌───────────────────────────────────────────────────────────────────┐
│  │ id   │ name   │ created_at   │ updated_at   │ ...                 │
│  ├──────┼────────┼──────────────┼──────────────┼─────────────────────┤
│  │ d001 │ Draft1 │ 2025-01-15   │ 2025-01-15   │ ...                 │
│  └───────────────────────────────────────────────────────────────────┘
│
├─ workflow_revisions ← workflows.id
│  1:N   3 related rows                                           [⤢ View Full]
│  ┌───────────────────────────────────────────────────────────────────┐
│  │ id    │ version │ created_at   │ created_by   │ ...               │
│  ├───────┼─────────┼──────────────┼──────────────┼───────────────────┤
│  │ rev-1 │ v1.0    │ 2025-01-10   │ admin        │ ...               │
│  │ rev-2 │ v1.1    │ 2025-01-11   │ admin        │ ...               │
│  │ rev-3 │ v1.2    │ 2025-01-15   │ user@ex...   │ ...               │
│  └───────────────────────────────────────────────────────────────────┘
│
└─ [+4 more relationships below]
```

**Key Features:**
- All relationships always expanded
- Tables shown inline
- Each relationship clearly labeled with arrow direction (→ ←)
- Clean, minimal design
- Maximum information density
- Pagination within each table section

**Visual Hierarchy:**
```
Header
├─ Relationship 1 (table header + 3 rows of data)
├─ Relationship 2 (table header + 3 rows of data)
├─ Relationship 3 (table header + 3 rows of data)
└─ [+N more]
```

---

## Comparison Matrix

| Feature | Proposal 1 (Tabs) | Proposal 2 (Cards) | Proposal 3 (Side-by-Side) | Proposal 4 (Flat) |
|---------|------------------|-------------------|-------------------------|-------------------|
| See all at once | ❌ | ✅ | ❌ | ✅ |
| Data preview quality | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Ease of switching | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 🚫 (Always expanded) |
| Visual clarity | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Mobile friendly | ⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ | ⭐⭐⭐⭐ |
| Code complexity | Medium | High | Very High | Low |
| Information density | Medium | High | Very High | Very High |
| Best for | Quick exploration | Overview | Power users | Simplicity |

---

## My Recommendation

**If you want professional UX:** → **Proposal 1 (Tabs)** or **Proposal 3 (Side-by-Side)**

**If you want maximum simplicity:** → **Proposal 4 (Flat)**

**If you want everything at once:** → **Proposal 2 (Cards)**

---

## Which one appeals to you?

Let me know and I'll build it out! 🎯
