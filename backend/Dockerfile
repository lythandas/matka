# Use a Node.js base image
FROM node:20-alpine

# Install sharp dependencies and curl for healthcheck
# libvips-dev is needed for sharp to compile correctly
RUN apk add --no-cache vips-dev build-base gcc autoconf automake zlib-dev curl

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json (if any)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3001

# Command to run the application
CMD ["npm", "start"]