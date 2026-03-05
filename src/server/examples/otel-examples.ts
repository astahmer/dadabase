/**
 * Examples: Using OpenTelemetry with Effect
 *
 * The TracerLive layer automatically instruments your app.
 * Most HTTP and database operations are automatically traced.
 */

import { Effect } from "effect";

/**
 * Effect.withSpan - Create a named span for a request
 */
export const processUserData = (userId: number) =>
  Effect.gen(function* () {
    yield* Effect.log(`Processing user ${userId}`);
    // Your logic here...
    return { userId, processed: true };
  }).pipe(Effect.withSpan("process-user-data", { attributes: { userId } }));

/**
 * Nested spans - Automatically shown in trace hierarchy
 */
export const complexOperation = Effect.gen(function* () {
  return yield* Effect.gen(function* () {
    yield* Effect.log("Step 1");
  }).pipe(
    Effect.withSpan("step-1"),
    Effect.flatMap(() =>
      Effect.gen(function* () {
        yield* Effect.log("Step 2");
      }).pipe(Effect.withSpan("step-2"))
    )
  );
}).pipe(Effect.withSpan("complex-operation"));
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
