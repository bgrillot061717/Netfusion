FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    EXPORT_DIR=/data

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps with strict constraints to avoid pyasn1 breakage
COPY requirements.txt /app/requirements.txt
COPY constraints.txt /app/constraints.txt
RUN python -m pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r /app/requirements.txt -c /app/constraints.txt

# Copy app code
COPY app /app/app

EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
