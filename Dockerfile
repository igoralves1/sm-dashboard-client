# =============================================================================
# sm-dashboard-client — Vite dev server
# docker build -t sm-dashboard-client .
# docker run --rm -p 5173:5173 --env-file .env sm-dashboard-client
# =============================================================================
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
