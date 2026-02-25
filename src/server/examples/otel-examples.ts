/**
 * Example: How to use OpenTelemetry in dadabase server
 * 
 * This shows various ways to integrate OTEL with your Effect code
 */

import { Effect, Layer, Console } from 'effect';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('dadabase', '0.0.1');

/**
 * Example 1: Simple manual span
 */
export function exampleSimpleSpan() {
  const span = tracer.startSpan('process-user-data');
  
  try {
    console.log('Processing user data...');
    span.setAttributes({
      'user.id': 123,
      'user.email': 'user@example.com',
    });
    
    // Do work...
    
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
  } finally {
    span.end();
  }
}

/**
 * Example 2: Effect with built-in tracing
 */
export const example2Effect = Effect.gen(function* () {
  yield* Console.log('Processing data with Effect');
  
  // Effect code here is automatically traced if SDK is initialized
  const result = yield* Effect.succeed({ processed: true });
  
  return result;
}).pipe(
  Effect.withSpan('example-effect-span')
);

/**
 * Example 3: Nested spans for hierarchical tracing
 */
export function exampleNestedSpans() {
  const parentSpan = tracer.startSpan('parent-operation');
  
  try {
    context.with(trace.setSpan(context.active(), parentSpan), () => {
      const childSpan = tracer.startSpan('child-operation');
      try {
        console.log('Child operation executing...');
      } finally {
        childSpan.end();
      }
    });
  } finally {
    parentSpan.end();
  }
}

/**
 * Example 4: Database query tracing
 * (Automatically traced by @opentelemetry/instrumentation-sql if using Node.js driver)
 */
export const exampleDatabaseQuery = Effect.gen(function* () {
  // Your SQL query here - automatically traced!
  console.log('Executing database query...');
  
  // This span is created automatically by the SQL instrumentation
  return { rows: [] };
});

/**
 * Example 5: Custom attributes in Effect
 */
export const exampleWithAttributes = Effect.gen(function* () {
  const activeSpan = trace.getActiveSpan();
  
  if (activeSpan) {
    activeSpan.setAttributes({
      'app.request.path': '/api/users',
      'app.request.method': 'GET',
      'app.response.status': 200,
    });
  }
  
  return { success: true };
}).pipe(
  Effect.withSpan('request-handler')
);

/**
 * Example 6: Error handling with spans
 */
export const exampleErrorHandling = Effect.gen(function* () {
  const span = tracer.startSpan('risky-operation');
  
  try {
    // Simulate an error
    throw new Error('Something went wrong!');
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error as Error).message,
    });
    
    yield* Console.error('Operation failed', error);
  } finally {
    span.end();
  }
});

/**
 * Usage:
 *
 * To enable OpenTelemetry in your application, you need to:
 *
 * 1. Import the initialization at the VERY START of your app:
 *    import '#src/server/otel-init'
 *
 * 2. Configure environment variables:
 *    OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
 *
 * 3. Run your app
 *
 * 4. Make requests to your application to generate traces
 *
 * 5. View traces in Glintlog: http://localhost:8080
 */
