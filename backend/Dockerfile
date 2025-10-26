FROM node:20-alpine

WORKDIR /app

# Copy package.json and tsconfig.json first to leverage Docker cache
# These files are specific to the backend directory due to docker-compose context
COPY package.json ./
COPY tsconfig.json ./

# Install all backend dependencies (including devDependencies for the build step)
RUN npm install

# Copy the rest of the backend source code, including config files
COPY . .

# Build the TypeScript application
RUN npm run build

# Command to run the compiled backend application
CMD ["npm", "start"]