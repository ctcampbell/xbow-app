FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build
EXPOSE ${PORT:-3000}
CMD ["sh", "-c", "./node_modules/.bin/serve -c /app/serve.json dist -l ${PORT:-3000}"]
