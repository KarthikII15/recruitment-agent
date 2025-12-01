# backend.Dockerfile
FROM python:3.10-slim

# Workdir inside container
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system deps (if you need poppler, libmagic, etc. you can add here)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY backend/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend /app

# Expose FastAPI port
EXPOSE 8000

# Run with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
