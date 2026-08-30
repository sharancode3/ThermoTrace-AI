FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for psycopg2 and GeoAlchemy
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    python3-dev \
    libglib2.0-0 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libgdk-pixbuf-xlib-2.0-0 \
    libcairo2 \
    libffi-dev \
    shared-mime-info \
    fonts-liberation \
    && ldconfig \
    && rm -rf /var/lib/apt/lists/*


COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Do not copy all files here so we can use live reload volume in docker-compose
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
