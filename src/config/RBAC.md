# RBAC Contract

Add roles in `roles.ts`, modules in `permissions.ts`, and actions in `actionPermissions.ts`.

Use `canAccessModule(role, PERMISSION_MODULES.USERS)` for route/module checks.

Use `canPerformAction(role, ACTIONS.USERS_CREATE)` for UI and service action checks.

Keep service-level guards in the owning module, such as `modules/users/services/serviceSecurity.ts`.
