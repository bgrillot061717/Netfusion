FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    EXPORT_DIR=/data

# Minimal system deps for cryptography/bcrypt wheels if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements from the backend build context
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy the FastAPI app code (again, paths are relative to ./backend)
COPY app /app/app

EXPOSE 18080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "18080"]
