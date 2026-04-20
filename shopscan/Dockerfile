ARG BUILD_FROM
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend-builder
WORKDIR /build
# build tools needed to compile better-sqlite3 native module
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm ci --production

FROM ${BUILD_FROM}

# Install Node.js + Chromium + nginx
RUN apk add --no-cache \
    nodejs \
    npm \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nginx \
    && rm -rf /var/cache/apk/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    CHROMIUM_FLAGS="--no-sandbox --disable-dev-shm-usage --headless"

# Copy built artifacts
COPY --from=backend-builder /build/node_modules /app/backend/node_modules
COPY backend/package.json /app/backend/package.json
COPY backend/src /app/backend/src
COPY --from=frontend-builder /build/dist /app/frontend

# S6 + nginx configs
COPY rootfs/ /

RUN chmod a+x /etc/services.d/nginx/run \
    /etc/services.d/nginx/finish \
    /etc/services.d/backend/run \
    /etc/services.d/backend/finish

EXPOSE 8099
