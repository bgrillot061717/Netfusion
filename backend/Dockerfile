FROM python:3.11-slim

# Prevent pip from writing .pyc and cache
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System updates (for cryptography wheels etc.); minimal to keep image small
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      libffi-dev \
      && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (better caching)
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy app
COPY backend/app /app/app

# Where the SQLite DB & map images live
ENV EXPORT_DIR=/data

EXPOSE 18080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "18080"]
