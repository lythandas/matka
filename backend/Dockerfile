# Use a Node.js base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
# to leverage Docker cache for dependencies
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript code into JavaScript
RUN npm run build

# Expose the port the Fastify app runs on
EXPOSE 3001

# Command to run the application
CMD ["npm", "start"]