# Stage 1: Build the backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci
COPY backend/src ./src
COPY backend/tsconfig.json .
RUN npm run build

# Stage 2: Install backend production dependencies only
FROM node:20-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev

# Stage 3: Build the frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ENV VITE_API_BASE_URL=/api
RUN npm run build

# Stage 4: Final image
FROM node:20-alpine
WORKDIR /app

COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY backend/package.json ./backend/
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules

COPY --from=frontend-builder /app/frontend/dist ./frontend-dist

RUN mkdir -p /app/uploads

ENV NODE_ENV=production
ENV UPLOADS_PATH=/app/uploads

EXPOSE 8080

CMD ["node", "backend/dist/server.js"]
