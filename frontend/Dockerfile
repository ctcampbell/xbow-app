FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE ${PORT:-3000}
CMD ["sh", "-c", "./node_modules/.bin/serve -s dist -l ${PORT:-3000}"]
