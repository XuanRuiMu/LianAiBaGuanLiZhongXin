FROM node:26.10.0-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
RUN npm run build && npm prune --omit=dev

FROM node:26.10.0-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/dist/ ./dist/
COPY --from=build /app/node_modules/ ./node_modules/
COPY package.json ./

# YH-137 缺USER探活：全root运行禁探活收敛为USER+HEALTHCHECK
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:3100/api/ready').then(r=>r.json()).then(b=>{if(b?.shu_ju?.jiu_xu!==true)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/启动.js"]
