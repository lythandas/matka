# Stage 1: Build the backend
FROM node:20-alpine as backend-builder
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm install
COPY backend/src ./src
COPY backend/tsconfig.json .
RUN npm run build

# Stage 2: Build the frontend
FROM node:20-alpine as frontend-builder
WORKDIR /app/frontend
COPY package.json ./  # Corrected: Only copy package.json
RUN npm install       # This will generate package-lock.json
COPY . .
# Set VITE_API_BASE_URL during the build process
ENV VITE_API_BASE_URL=/api
RUN npm run build

# Stage 3: Final image
FROM node:20-alpine
WORKDIR /app

# Copy backend build artifacts and production dependencies
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY backend/package.json ./backend/
COPY backend/node_modules ./backend/node_modules

# Copy frontend build artifacts
COPY --from=frontend-builder /app/frontend/dist ./frontend-dist

# Create uploads directory
RUN mkdir -p /app/uploads

# Set environment variables for the runtime
ENV NODE_ENV=production
ENV BACKEND_EXTERNAL_URL=http://localhost:8080
ENV UPLOADS_DIR=/app/uploads

# Expose the port Fastify will listen on
EXPOSE 8080

# Command to run the Fastify backend server
CMD ["node", "backend/dist/server.js"]