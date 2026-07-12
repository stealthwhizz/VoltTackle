import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { defaultResource, resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { trace, type Tracer } from "@opentelemetry/api";

export interface InitTracingOptions {
  serviceName: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
  consoleExporter?: boolean;
}

let sdk: NodeSDK | undefined;

export function initTracing(options: InitTracingOptions): () => Promise<void> {
  const exporter = options.otlpEndpoint
    ? new OTLPTraceExporter({ url: options.otlpEndpoint })
    : new ConsoleSpanExporter();

  sdk = new NodeSDK({
    resource: defaultResource().merge(
      resourceFromAttributes({
        [ATTR_SERVICE_NAME]: options.serviceName,
        [ATTR_SERVICE_VERSION]: options.serviceVersion ?? "0.1.0",
      }),
    ),
    traceExporter: exporter,
    instrumentations: [getNodeAutoInstrumentations({ "@opentelemetry/instrumentation-fs": { enabled: false } })],
  });

  sdk.start();

  return async () => {
    await sdk?.shutdown();
  };
}

export function getTracer(name: string): Tracer {
  return trace.getTracer(name);
}
