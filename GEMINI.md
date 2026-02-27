# GEMINI.md - AI System Context

## Architecture Summary
- **Hybrid Core**: Rust (rsdk-core) + TypeScript (tsdk).
- **Communication**: NAPI-RS FFI bridge.
- **Sidecars**: Vector (Logs at :9000) and Caddy (Gateway at :8080).
- **Telemetry**: Unified JSON logs via Pino/Tracing -> Vector.

## AI Instructions
- Maintain type-safety across the FFI boundary.
- All logs must be JSON-structured for Vector compatibility.
- Use 'pnpm cockpit' for all lifecycle operations.\n