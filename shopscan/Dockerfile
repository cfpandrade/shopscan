ARG BUILD_FROM=node:20-alpine

FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend-builder
WORKDIR /build
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm install --production

FROM ${BUILD_FROM}

# Chromium + nginx + fonts needed for Playwright scraping
RUN apk add --no-cache \
    nginx \
    chromium \
    python3 \
    py3-pip \
    build-base \
    pkgconf \
    libffi \
    libffi-dev \
    python3-dev \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

RUN ARCH="$(apk --print-arch)" \
    && if [ "$ARCH" = "armv7" ]; then \
      echo "Skipping curl_cffi install on unsupported arch: $ARCH"; \
    else \
      python3 -m pip install --break-system-packages --no-cache-dir curl_cffi; \
    fi

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROMIUM_PATH=/usr/bin/chromium

# Backend
COPY --from=backend-builder /build/node_modules /app/backend/node_modules
COPY backend/package.json /app/backend/package.json
COPY backend/src /app/backend/src

# Frontend
COPY --from=frontend-builder /build/dist /app/frontend

# nginx config
COPY rootfs/etc/nginx/http.d/default.conf /etc/nginx/http.d/default.conf

# Startup script
COPY run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 8099
CMD ["/run.sh"]
