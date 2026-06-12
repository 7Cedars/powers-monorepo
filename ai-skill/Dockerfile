FROM ubuntu:24.04

RUN apt-get update && apt-get install -y curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g pnpm@10 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (cached unless package files change)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source material for ingest and the TypeScript source
COPY sources/ ./sources/
COPY references/ ./references/
COPY src/ ./src/
COPY tsconfig.json ./

# Generate the embedding index — downloads the nomic-embed model (~275 MB) on first build,
# then cached by Docker layer. Re-runs only if sources/ or references/ change.
RUN pnpm ingest

# Compile TypeScript
RUN pnpm build

EXPOSE 3000
CMD ["node", "dist/server.js"]
