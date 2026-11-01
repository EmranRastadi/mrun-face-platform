FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt pyproject.toml ./
COPY wheels/ ./wheels/
# Offline-friendly: wheels are vendored in ./wheels (see README "vendored wheels").
# --find-links lets pip use the vendored dir and fall back to PyPI for anything
# missing or built for another platform (e.g. x86_64 wheels on an arm64 Mac).
# Keep this as a single && chain so a failed install fails the build instead of
# silently producing an image without dependencies.
RUN pip install --no-cache-dir --retries 10 --timeout 120 --find-links=./wheels -r requirements.txt \
 && rm -rf ./wheels

COPY src/ ./src/

RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')"

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001"]
