FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm i --omit=dev
COPY . .
RUN npm run build || true
EXPOSE 4000 3000 8080
CMD ["node", "server/server.mjs"]
