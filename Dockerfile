FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
RUN addgroup -S -g 10001 nodeapp && adduser -S -D -H -u 10001 -G nodeapp nodeapp
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=nodeapp:nodeapp /app/dist/src ./dist/src
COPY --from=build --chown=nodeapp:nodeapp /app/node_modules/.prisma ./node_modules/.prisma
USER 10001:10001
EXPOSE 3000
CMD ["node", "--import", "dd-trace/initialize.mjs", "dist/src/main.js"]
