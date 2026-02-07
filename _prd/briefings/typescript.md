# TypeScript Briefing

> Algemene kennis over TypeScript/Node.js development voor KITT.

---

## Jouw Scope

Dit is de baseline briefing voor alle features:
- TypeScript best practices
- Node.js patterns
- Project conventions
- Testing approach

---

## Project Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript 5.x |
| Runtime | Node.js 22+ |
| Package Manager | npm of pnpm |
| Formatting | Prettier (indien geconfigureerd) |
| Linting | ESLint (indien geconfigureerd) |

---

## Code Conventions

### File Naming
- `kebab-case.ts` voor files
- `PascalCase` voor classes
- `camelCase` voor functions/variables

### Imports
```typescript
// External first
import fs from 'fs';
import path from 'path';

// Then internal
import { Config } from './config.js';
import { MessageBridge } from './bridge/index.js';
```

### Types
```typescript
// Prefer interfaces for objects
interface Message {
  id: string;
  content: string;
  timestamp: Date;
}

// Use type for unions/primitives
type Channel = 'whatsapp' | 'telegram' | 'email';
```

### Error Handling
```typescript
try {
  await doSomething();
} catch (error) {
  // Always type errors
  if (error instanceof SpecificError) {
    // Handle specific error
  }
  throw error; // Re-throw if not handled
}
```

---

## Async Patterns

### File Operations
```typescript
import fs from 'fs/promises';

// Prefer async/await
const content = await fs.readFile(path, 'utf-8');

// Atomic writes
const tempPath = `${filepath}.tmp`;
await fs.writeFile(tempPath, content);
await fs.rename(tempPath, filepath);
```

### Parallel Execution
```typescript
// Independent operations - parallel
const [resultA, resultB] = await Promise.all([
  fetchA(),
  fetchB()
]);

// Dependent operations - sequential
const a = await fetchA();
const b = await fetchB(a.id);
```

---

## Testing

### Structure
```
src/
├── bridge/
│   ├── index.ts
│   └── index.test.ts  # Co-located tests
```

### Pattern
```typescript
import { describe, it, expect } from 'vitest';

describe('MessageBridge', () => {
  it('should process incoming message', async () => {
    const bridge = new MessageBridge();
    const result = await bridge.process(mockMessage);
    expect(result.status).toBe('success');
  });
});
```

---

## Reference Projects

### NanoClaw
- Simple, clean TypeScript
- Good example of file-based architecture
- Location: `_repos/nanoclaw/src/`

### OpenClaw
- More complex, enterprise patterns
- Good example of plugin architecture
- Location: `_repos/openclaw/src/`
