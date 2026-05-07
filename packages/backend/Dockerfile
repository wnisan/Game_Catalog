FROM node:22-alpine AS build

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml tsconfig.base.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/backend/package.json ./packages/backend/package.json
RUN corepack enable && yarn install

COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend
RUN yarn workspace @game-catalog/shared build && yarn workspace @game-catalog/backend build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/backend/package.json ./packages/backend/package.json
COPY --from=build /app/packages/backend/dist ./packages/backend/dist

EXPOSE 3001
CMD ["node", "packages/backend/dist/server.js"]
