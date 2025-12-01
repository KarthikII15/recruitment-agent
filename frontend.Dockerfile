# frontend.Dockerfile

### 1. Build stage ###
FROM node:20-alpine AS build

WORKDIR /app

# Install deps
COPY frontend/package*.json ./
RUN npm install

# Copy source and build
COPY frontend /app
RUN npm run build

### 2. Nginx serve stage ###
FROM nginx:1.27-alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom config
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy Vite build output
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
