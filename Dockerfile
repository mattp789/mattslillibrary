FROM node:20-alpine

WORKDIR /app

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server source
COPY server.js ./
COPY lib/ ./lib/
COPY middleware/ ./middleware/
COPY routes/ ./routes/
COPY scripts/ ./scripts/

EXPOSE 3000

CMD ["node", "server.js"]
