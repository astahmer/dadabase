---
name: creating-a-skill
description: Guidance for creating focused, concise skills that teach specific techniques. Skills are reusable knowledge modules organized in .agents/skills/ with clear examples and minimal boilerplate.
---

# Creating a Skill

Skills teach focused techniques in a concise, actionable format. They're stored in `.agents/skills/` and invoked when relevant to a task.

## Skill Structure

```
.agents/skills/
└── skill-name/
    ├── SKILL.md              # ← Single skill file
    └── (optional examples)
```

## SKILL.md Template

```markdown

---
name: skill-name
description: One-line description of what this teaches
---

# Skill Title

Brief intro (1-2 sentences max).

## Quick Template

Show the core pattern/code concisely.

**Rules/Guidelines:**
- List key points as bullet items
- Keep it minimal and direct

## Real Example

Link to an actual implementation: [file-name.ts](../../path/to/file.ts)

## Workflow

Numbered steps (optional, only if sequence matters).


```

## Key Principles

1. **Concise** - Cut unnecessary explanation; show patterns not theory
2. **Actionable** - Include code templates and clear rules
3. **Reusable** - Teach a technique applicable across projects
4. **Linked** - Reference real examples from the codebase
5. **Minimal** - Avoid walkthroughs, best practices tables, troubleshooting unless essential

## When to Create a Skill

- A technique developers will use repeatedly
- Complex enough to need organized guidance but simple enough to fit one page
- Tied to your project's specific patterns (architecture, naming, structure)
- You find yourself explaining it multiple times

## Examples

- `example-component/` - Creating minimal interactive UI component demos
- Write concise skills for: database query patterns, component styling, form handling, etc.
