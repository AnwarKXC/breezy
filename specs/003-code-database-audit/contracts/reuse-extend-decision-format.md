# Reuse/Extend/Create Decision Format Contract

Each decision entry in the findings report (`findings/reuse-extend-decisions.md`) MUST follow this structure:

```markdown
## Entity: [entity_name]

**Existing Match**: [table/module name or "none"]

**Decision**: [Reuse as-is | Extend | Create]

**Rationale**: [why this decision was made, referencing specific findings]

**Evidence**:
- [specific finding from code or database audit]

**If Extend**:
- New columns needed: [list]
- New indexes needed: [list]
- API changes needed: [list]

**Risks**: [any risks with this decision]
```
