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

# Keep a backup of initial data (volume will mount over dist/data)
RUN cp -r src/data /app/data-init

# Copy and prepare entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose port
EXPOSE 3005

# Use entrypoint script to handle volume initialization
ENTRYPOINT ["/app/entrypoint.sh"]
