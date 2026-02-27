# USAGE.md - Developer Quick Start

## 📦 SDK Usage (TypeScript)
```typescript
import { RSdk, LoggersSection } from './packages/tsdk/src/index.js';

// Use the Rust-backed bridge
const status = RSdk.checkRsdkStatus();
console.log(`Bridge Status: ${status}`);

// Use the Unified Logger (Streams to Vector sidecar)
LoggersSection.logger.info({ 
    msg: "Application started", 
    rust_status: status 
});
```