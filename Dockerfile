FROM node:18-bullseye-slim

# Create app directory
WORKDIR /app

# Node environment
ENV NODE_ENV=production
# Default port (Fly will override via $PORT)
ENV PORT=3000

# Install dependencies first (package.json + package-lock.json)
COPY package*.json ./

# Install all dependencies. Using npm ci for reproducible installs.
RUN npm ci --production || npm ci

# Copy application source
COPY . .

# Ensure uploads folder exists
RUN mkdir -p uploads

# Expose the app port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
