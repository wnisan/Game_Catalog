FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_STRIPE_PUBLIC_KEY
ENV VITE_STRIPE_PUBLIC_KEY=$VITE_STRIPE_PUBLIC_KEY

COPY package.json yarn.lock .yarnrc.yml tsconfig.base.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json
RUN corepack enable && yarn install

COPY packages/shared ./packages/shared
COPY packages/frontend ./packages/frontend
RUN yarn workspace @game-catalog/shared build && yarn workspace @game-catalog/frontend build

FROM nginx:1.29-alpine
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
