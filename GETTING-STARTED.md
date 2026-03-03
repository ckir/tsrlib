# TSRLIB — Getting Started Guide

^**TSRLIB^*** is a high-performance TypeScript SDK with a native Rust bridge (via NAPI-RS).  
It gives you:

- Ultra-fast Rust-powered core (tracing, status checks)
- Production-grade logging & telemetry (streams to Vector sidecar)
- Resilient HTTP client (`RequestUnlimited`)
- Real-time market data (Nasdaqk + Yahoo Finance streaming)
- Config management, utilities, and more

Works perfectly on **Windows, Linux, macOS** (x64 + arm64) with **Node.js** and **Bun**.

---


## 1. Installation

bash
# npm
npm install tsrlib

# pnpm (recommended)
pnpm add tsrlib

# Bun
bun add tsrlib


---

## 2. One-Time Setup: Download Binaries

TSRLIB needs three binaries:
- `rsdk.node` — Native Rust bridge
- `vector` — Telemetry sidecar
- `caddy` — API proxy (optional)

Run this **once** after installation (or after every major update):

bash
npx tsx ./node_modules/tsrlib/packages/sidecars/src/sync-binaries.ts