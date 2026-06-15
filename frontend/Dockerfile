# Frontend dev server (Vite). For a local demo we run Vite directly so the API
# URL can be provided at runtime via VITE_API_URL.
FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
