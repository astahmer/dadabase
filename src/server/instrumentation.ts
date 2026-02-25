/**
 * OpenTelemetry Instrumentation Setup
 * Connects to Glintlog instance for distributed tracing
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { Resource } from "@opentelemetry/resources";

// Configuration from environment variables with sensible defaults
const GLINTLOG_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || "dadabase";
const SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION || "0.0.1";

/**
 * Initialize OpenTelemetry SDK with OTLP HTTP exporter
 * This will automatically instrument HTTP, database, and other common libraries
 */
export function initializeOpenTelemetry(): NodeSDK {
  // Create OTLP exporter pointing to Glintlog
  const traceExporter = new OTLPTraceExporter({
    url: `${GLINTLOG_ENDPOINT}/v1/traces`,
    headers: {
      // Optional: Add custom headers here if needed for authentication
      // "Authorization": "Bearer your-token"
    },
    // Timeout for export requests
    timeoutMillis: 30000,
    // Limit on pending requests
    concurrencyLimit: 10,
  });

  // Create SDK with auto-instrumentation
  const sdk = new NodeSDK({
    // Service identification
    resource: new Resource({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
    }),

    // Trace exporter configuration
    traceExporter: traceExporter,

    // Auto-instrumentation for common modules
    instrumentations: [
      // Auto-instrument HTTP, Express, database, and other common libraries
      ...getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-express": {
          enabled: true,
          // Ignore health check and ready endpoints
          ignorePaths: ["/health", "/ready", "/.well-known"],
        },
        "@opentelemetry/instrumentation-http": {
          enabled: true,
          // Ignore certain paths to reduce noise
          ignoreIncomingPaths: [/^\/health/, /^\/ready/],
          requestHook: (span, request) => {
            // Add custom attributes to HTTP spans if needed
            span.setAttribute("http.client_ip", request.socket?.remoteAddress || "unknown");
          },
        },
        // Other instrumentations will be auto-discovered
        "@opentelemetry/instrumentation-fs": {
          enabled: false, // Disable filesystem instrumentation as it's noisy
        },
      }),
    ],
  });

  // Start SDK - this must be called before any code that uses tracing
  sdk.start();

  console.log(`[OpenTelemetry] Initialized`);
  console.log(`[OpenTelemetry] Service: ${SERVICE_NAME}@${SERVICE_VERSION}`);
  console.log(`[OpenTelemetry] Exporting traces to: ${GLINTLOG_ENDPOINT}/v1/traces`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[OpenTelemetry] Shutting down");
    try {
      await sdk.shutdown();
      console.log("[OpenTelemetry] Shutdown complete");
    } catch (error) {
      console.error("[OpenTelemetry] Error during shutdown:", error);
    }
  };

  // Handle graceful shutdown on SIGTERM and SIGINT
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return sdk;
}

/**
 * Initialize without instrumentation (for testing or minimal setup)
 */
export function initializeOpenTelemetryMinimal(): NodeSDK {
  const traceExporter = new OTLPTraceExporter({
    url: `${GLINTLOG_ENDPOINT}/v1/traces`,
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
    }),
    traceExporter: traceExporter,
  });

  sdk.start();
  return sdk;
}
