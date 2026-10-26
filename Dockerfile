# =================================================================
# Stage 1: Build Frontend (React + Vite + Tailwind CSS)
# =================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# =================================================================
# Stage 2: Production Python Backend + Static Frontend Assets
# =================================================================
FROM python:3.11-slim

WORKDIR /app

# System dependencies for building and running ML/scientific packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python production dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and prebuilt frontend
COPY . .
COPY --from=frontend-builder /app/dist ./dist

# Environment settings
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
EXPOSE 8000

# Run FastAPI production server via Uvicorn
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
