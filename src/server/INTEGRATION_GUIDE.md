# OpenTelemetry Integration Guide

## Setup

### 1. Environment Variables

Create `.env.local` or add to `.env`:
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=dadabase
OTEL_SERVICE_VERSION=0.0.1
```

### 2. Provide TracerLive Layer

In your Effect app or server setup, provide the `TracerLive` layer:

```typescript
import { TracerLive } from "./otel-init.js";
import { Layer } from "effect";

// When creating your app:
app.pipe(Layer.provide(TracerLive));
```

## How It Works

- `TracerLive` is an Effect Layer that configures OpenTelemetry
- Automatically exports traces to `OTEL_EXPORTER_OTLP_ENDPOINT`
- Uses `@effect/opentelemetry/Otlp` for seamless Effect integration
- All HTTP and database operations are traced automatically
OTEL_SERVICE_NAME=dadabase
OTEL_SERVICE_VERSION=0.0.1
`;


/**
 * Troubleshooting:
 *
 * Q: I don't see traces in Glintlog
 * A: 1. Check that glintlog is running (curl http://localhost:8080/health)
 *    2. Verify OTEL_EXPORTER_OTLP_ENDPOINT is correct
 *    3. Make sure you've made HTTP requests to generate traces
 *    4. Check server console for any OTEL errors
 *
 * Q: Lots of noise in traces
 * A: Adjust ignorePaths in src/server/instrumentation.ts
 *    to exclude health checks and other noisy endpoints
 *
 * Q: Want to add custom tracing to my code?
 * A: See src/server/examples/otel-examples.ts for examples
 */
