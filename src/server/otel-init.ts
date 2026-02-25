/**
 * Early initialization of OpenTelemetry
 * This MUST be imported before any other application code
 * 
 * Usage:
 *   In your entry point (very first thing):
 *   import './server/otel-init'
 */

// Only initialize in Node.js environment
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  const { initializeOpenTelemetry } = await import('./instrumentation');
  
  try {
    initializeOpenTelemetry();
  } catch (error) {
    console.error('[OpenTelemetry] Failed to initialize:', error);
    // Continue anyway - don't let tracing failures break the app
  }
}
