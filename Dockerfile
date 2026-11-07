FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp
COPY --from=build --chown=nodeapp:nodeapp /app/dist/src ./dist/src
USER nodeapp
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
