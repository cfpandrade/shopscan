ARG BUILD_FROM=node:20-alpine

FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend-builder
WORKDIR /build
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm ci --production

FROM ${BUILD_FROM}

RUN apk add --no-cache nginx

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
