/**
 * Integration Guide for TanStack Start + OpenTelemetry
 * 
 * This shows how to properly initialize OpenTelemetry in a TanStack Start app
 */

/**
 * STEP 1: Update your server entry point
 * 
 * In your main server file (e.g., src/server/entry.ts or similar),
 * add this FIRST line of all imports:
 */

// ======= YOUR MAIN SERVER FILE =======
// // IMPORTANT: This must be FIRST
// import './otel-init'
//
// import express from 'express'
// // ... rest of your imports


/**
 * STEP 2: If using TanStack Start with Vite
 * 
 * The instrumentation should automatically work once imported because
 * TanStack Start's Vite dev server and build will run with the OTEL
 * initialization in place.
 */


/**
 * STEP 3: Verify it's working
 * 
 * You should see logs like:
 * 
 * [OpenTelemetry] Initialized
 * [OpenTelemetry] Service: dadabase@0.0.1
 * [OpenTelemetry] Exporting traces to: http://localhost:4318/v1/traces
 */


/**
 * STEP 4: Generate some activity
 * 
 * Make HTTP requests to your app. You should see:
 * - Console logs from the instrumentation
 * - Spans appearing in Glintlog at http://localhost:8080
 */


/**
 * STEP 5: View traces in Glintlog
 * 
 * 1. Open http://localhost:8080
 * 2. Go to Traces section (if available) or check the main dashboard
 * 3. You should see spans from:
 *    - HTTP requests/responses
 *    - Database queries
 *    - Express/middleware processing
 */


/**
 * Custom Span Example in your route handlers:
 */
export function exampleRouteHandler() {
  /*
  import { trace } from '@opentelemetry/api'
  
  const tracer = trace.getTracer('dadabase', '0.0.1')
  
  app.get('/api/users/:id', (req, res) => {
    const span = tracer.startSpan('get-user', {
      attributes: {
        'user.id': req.params.id,
      }
    })
    
    try {
      // Fetch user
      const user = { id: req.params.id, name: 'John' }
      res.json(user)
    } finally {
      span.end()
    }
  })
  */
}


/**
 * Environment Configuration
 * 
 * .env.local should contain:
 */
const envExample = `
# Glintlog OTEL Endpoint
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Service Info
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
