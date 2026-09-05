FROM node:20-alpine AS 构建

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE=http://localhost:8080
ARG VITE_AI_BASE=http://localhost:8000
ENV VITE_API_BASE=${VITE_API_BASE} \
    VITE_AI_BASE=${VITE_AI_BASE}
RUN npm run build

FROM nginx:alpine

COPY --from=构建 /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
    CMD wget -q -O /dev/null http://localhost:80/ || exit 1
