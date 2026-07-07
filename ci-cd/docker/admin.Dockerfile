# Self-contained build for admin-console (mirrors ci-cd/docker/frontend.Dockerfile).
# Production still serves via nginx on port 80 inside the container — the
# "different port" for admin-console (3001) only applies to the local Vite
# dev server (see admin-console/vite.config.js). In the cluster, client vs
# admin isolation comes from being separate Deployments/Services
# (platform-web vs platform-admin), not from a different container port.
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
