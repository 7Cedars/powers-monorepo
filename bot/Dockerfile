# Use Ubuntu 24.04 LTS which has GLIBC 2.39
FROM ubuntu:24.04

# Set environment variables
ENV NODE_VERSION=24.0.0
ENV PNPM_VERSION=10.32.1
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 24
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm@${PNPM_VERSION}

# Set working directory
WORKDIR /var/task

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Remove devDependencies to reduce image size (optional)
RUN pnpm prune --prod

# Expose port
EXPOSE 3001

# Start the Express server
CMD ["node", "dist/server.js"]
