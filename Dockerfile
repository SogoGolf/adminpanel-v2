# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Set environment variables for Vite build
ENV VITE_SOGO_API_URL=https://sogo-api.azure-api.net/sogo-general
ENV VITE_AZURE_API_KEY=f128c9a7885d4820b9604f185dfe310f

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Cloud Run uses port 8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
