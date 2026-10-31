"""Prometheus metrics + OpenTelemetry tracing for mrun FastAPI services.

Metrics are exposed on `/metrics` and scraped by Prometheus through the
ServiceMonitor in `infrastructure/apps/<service>/servicemonitor.yaml`.

Tracing is opt-in: it is a no-op unless OTEL_EXPORTER_OTLP_ENDPOINT is set and
OTEL_ENABLED is not "false".
"""

from __future__ import annotations

import os

from prometheus_fastapi_instrumentator import Instrumentator

_instrumented = False
_tracing_configured = False


def setup_observability(app, service_name: str, version: str = "1.0.0") -> None:
    """Instrument a FastAPI app with Prometheus metrics and OTLP tracing."""
    global _instrumented

    if not _instrumented:
        Instrumentator().instrument(app).expose(
            app, endpoint="/metrics", include_in_schema=False
        )
        _instrumented = True

    _setup_tracing(app, service_name, version)


def _setup_tracing(app, service_name: str, version: str) -> None:
    global _tracing_configured

    if _tracing_configured:
        return

    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if os.getenv("OTEL_ENABLED", "true").lower() == "false" or not endpoint:
        return

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError:  # pragma: no cover - tracing deps are optional at runtime
        return

    base = endpoint.rstrip("/")
    if base.endswith("/v1/traces"):
        base = base[: -len("/v1/traces")]

    provider = TracerProvider(
        resource=Resource.create(
            {
                "service.name": os.getenv("OTEL_SERVICE_NAME", service_name),
                "service.version": version,
                "deployment.environment": os.getenv("ENVIRONMENT", "development"),
            }
        )
    )
    provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{base}/v1/traces"))
    )
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)
    _tracing_configured = True
