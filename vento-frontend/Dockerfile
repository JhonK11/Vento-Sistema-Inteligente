# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Build con la variable de entorno que ser sobreescrita o por defecto
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL:-http://localhost:8000/api}

RUN npm run build

# Stage 2: Serve con Nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Aadir configuracin custom para que React Router funcione (fallback a index.html)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

