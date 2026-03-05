# OpenTelemetry Setup

This project uses `@effect/opentelemetry/Otlp` to send traces to Glintlog.

## Quick Start

### 1. Environment Variables

Create `.env.local`:
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=dadabase
OTEL_SERVICE_VERSION=0.0.1
```

### 2. Provide TracerLive in Your App

```typescript
import { TracerLive } from "./server/otel-init.js";
import { Layer } from "effect";

// When setting up your Effect app:
app.pipe(Layer.provide(TracerLive));
```

### 3. Verify Glintlog is Running

```bash
cd /Users/astahmer/dev/glintlog
./glintlog
```

Check: `curl http://localhost:8080/health`

### 4. View Traces

Open http://localhost:8080 → Navigate to Traces section

## Configuration

All configuration comes from environment variables:

| Variable | Default | Description |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | Glintlog OTLP endpoint |
| `OTEL_SERVICE_NAME` | `dadabase` | Service identifier |
| `OTEL_SERVICE_VERSION` | `0.0.1` | Service version |

## Files

- `src/server/instrumentation.ts` - Defines `TracerLive` layer
- `src/server/otel-init.ts` - Re-exports `TracerLive`

## Troubleshooting

**Traces not appearing?**
- Verify Glintlog is running on port 8080
- Check OTEL_EXPORTER_OTLP_ENDPOINT matches Glintlog's OTLP endpoint
- Look at server console for any OTEL errors
- Make sure your app is actually making requests
