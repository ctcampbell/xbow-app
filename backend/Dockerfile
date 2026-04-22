FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN mkdir -p /exports
EXPOSE 3001
CMD ["node", "dist/index.js"]
