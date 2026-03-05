import * as Otlp from "@effect/opentelemetry/Otlp";
import { NodeHttpClient } from "@effect/platform-node";
import { Layer } from "effect";

/**
 * OpenTelemetry layer for distributed tracing to Glintlog
 * Provide this layer to your Effect app to enable tracing
 *
 * Usage:
 *   app.pipe(Layer.provide(TracerLive))
 */
export const TracerLive = Otlp.layer({
  baseUrl:
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318",
  resource: {
    serviceName: process.env.OTEL_SERVICE_NAME || "dadabase",
    serviceVersion: process.env.OTEL_SERVICE_VERSION || "0.0.1",
  },
}).pipe(Layer.provide(NodeHttpClient.layerUndici));
