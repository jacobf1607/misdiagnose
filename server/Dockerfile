FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Copy data folder to dist (TypeScript doesn't copy non-TS files)
RUN cp -r src/data dist/

# Expose port
EXPOSE 3005

# Start the server
CMD ["npm", "start"]
