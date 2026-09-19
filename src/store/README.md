// 📁 src/store/README.md
# Redux Store

Redux Toolkit store configuration.

## Structure:
```
store/
├── index.ts          # Store configuration
├── slices/           # Redux slices
│   ├── uiSlice.ts   # UI state
│   └── authSlice.ts # Auth state (optional)
└── hooks.ts         # Typed hooks
```

## Usage:
```typescript
import { useAppSelector, useAppDispatch } from '@/store/hooks'
```