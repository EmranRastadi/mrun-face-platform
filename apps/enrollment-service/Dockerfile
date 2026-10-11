FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt pyproject.toml ./
COPY wheels/ ./wheels/
# Offline-friendly: wheels are vendored in ./wheels (see README "vendored wheels").
# Falls back to PyPI only for anything missing from the vendored dir.
RUN pip install --no-cache-dir --no-index --find-links=./wheels -r requirements.txt \
 || pip install --no-cache-dir -r requirements.txt; rm -rf ./wheels

COPY src/ ./src/

RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')"

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001"]
