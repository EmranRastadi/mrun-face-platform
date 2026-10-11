FROM python:3.12-slim

WORKDIR /app

COPY . .

# Offline-friendly: wheels are vendored in ./wheels (see README "vendored wheels").
# Falls back to PyPI only for anything missing from the vendored dir.
RUN pip install --no-cache-dir --no-index --find-links=./wheels -r requirements.txt \
 || pip install --no-cache-dir -r requirements.txt; rm -rf ./wheels

# Best practice: run as non-root.
RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Best practice: no --reload in production; bind port from $PORT when set.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
