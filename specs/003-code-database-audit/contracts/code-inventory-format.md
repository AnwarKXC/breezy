# Code Inventory Format Contract

Each module entry in the code inventory (`findings/code-inventory.md`) MUST follow this structure:

```markdown
## Module: [module-name]

**Path**: `src/modules/[module-name]/`

**Exported Types**:
- `[TypeName]` — [brief description]
- `[TypeName]` — [brief description]

**Exported Interfaces**:
- `[InterfaceName]` — [key properties]

**Key Functions**:
- `[functionName](params): returnType` — [purpose]

**Existing Patterns**: [naming conventions, error handling approach, validation patterns]

**Limitations / Gaps**: [what is missing or incomplete]

**Reuse Assessment**: [exists and can be extended / exists but needs modification / must be created]
```
