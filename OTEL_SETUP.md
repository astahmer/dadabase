# OpenTelemetry Integration with Glintlog

This project has been configured to send distributed traces to Glintlog via OpenTelemetry (OTEL).

## Setup

### 1. Environment Variables

Add these to your `.env.local` or `.env`:

```bash
# Glintlog OpenTelemetry endpoint (default: http://localhost:4318)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Service identification
OTEL_SERVICE_NAME=dadabase
OTEL_SERVICE_VERSION=0.0.1
```

### 2. Enable OpenTelemetry

OpenTelemetry is configured automatically when the server starts. The configuration includes:

- **Auto-instrumentation** for HTTP, Express, database queries, and common Node.js modules
- **Batch span export** to Glintlog OTLP collector
- **Graceful shutdown** handling

### 3. Connect to Glintlog

Ensure Glintlog is running locally:

```bash
cd /Users/astahmer/dev/glintlog
./glintlog
```

Glintlog listens on:
- **Web UI**: http://localhost:8080
- **OTLP gRPC**: localhost:4317
- **OTLP HTTP**: http://localhost:4318

### 4. View Traces

Once the server is running and generating traces:

1. Open http://localhost:8080 in your browser
2. Navigate to the **Traces** or **Distributed Tracing** section
3. You'll see spans from your dadabase application

## Manual Integration

To manually create spans in your Effect code:

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('dadabase', '0.0.1');

const span = tracer.startSpan('my-span');
try {
  // Do something
} finally {
  span.end();
}
```

Or with Effect's built-in tracing:

```typescript
import { Effect } from 'effect';

Effect.gen(function* () {
  // Your code here is automatically traced
  yield* Effect.logInfo("Processing request");
}).pipe(Effect.traced);
```

## Configuration Files

- `src/server/instrumentation.ts` - Core OTEL SDK setup
- `src/server/otel-init.ts` - Early initialization (import this first)

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | Glintlog OTLP collector endpoint |
| `OTEL_SERVICE_NAME` | `dadabase` | Service name for traces |
| `OTEL_SERVICE_VERSION` | `0.0.1` | Service version for traces |
| `NODE_ENV` | (varies) | Set to skip OTEL in test environments |

## Troubleshooting

### Traces not appearing

1. Check that Glintlog is running: `curl http://localhost:8080/health`
2. Verify the OTEL endpoint is correct in your environment
3. Check browser console and server logs for errors
4. Ensure the server is actually making requests/queries (traces only fire on activity)

### High span volume

Adjust filtering in `src/server/instrumentation.ts`:
- Add more paths to `ignorePaths`
- Disable noisy instrumentations like filesystem access
- Adjust `maxQueueSize` and `scheduledDelayMillis`

### Authentication needed

If Glintlog requires auth:

```typescript
// In src/server/instrumentation.ts
headers: {
  'Authorization': `Bearer ${process.env.GLINTLOG_API_KEY}`
}
```

## Next Steps

- Set up additional exporters (metrics, logs)
- Create custom spans for business logic
- Add custom attributes to spans
- Set up alerts based on trace patterns
