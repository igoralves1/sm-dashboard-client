# =============================================================================
# sm-dashboard-client — Vite dev server
#
# Build context must be the sm-dashboard-client/ root:
#   docker build -f Docker/Dockerfile -t sm-dashboard-client .
#
# Or use docker-compose (recommended):
#   docker compose -f Docker/docker-compose.yml up --build
# =============================================================================
FROM node:22-alpine

WORKDIR /app

# Install dependencies first (cached layer — only re-runs when package.json changes)
COPY package*.json ./
RUN npm install

# Copy source (overridden by volume mount in docker-compose for live reload)
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
