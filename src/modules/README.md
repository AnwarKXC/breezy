// 📁 src/modules/README.md
# Modules

Each feature module lives here in its own directory.

## Structure:
```
modules/{module}/
├── components/         # Module-specific components
├── hooks/             # Custom React hooks
├── services/          # API/data services
├── store/             # Redux slices (optional)
├── types.ts          # TypeScript types
└── index.ts          # Public exports
```

## Adding a new module:
1. Create `src/modules/{module-name}/`
2. Add components, hooks, services as needed
3. Export from `index.ts`