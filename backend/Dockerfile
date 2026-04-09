FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    poppler-utils \
    postgresql-client \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=45s --start-period=60s --retries=5 \
    CMD curl --fail --silent --show-error --max-time 20 http://localhost:8000/health || exit 1

ENV APP_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=8000

CMD ["sh", "/app/scripts/start.sh"]
