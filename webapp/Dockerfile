# base node image
FROM node:20-bookworm-slim AS base

# set for base and all layer that inherit from it
ENV NODE_ENV="production"

RUN apt-get update && apt-get install -y fuse3 openssl sqlite3 ca-certificates

# Install all node_modules, including dev dependencies
FROM base AS deps

WORKDIR /myapp

ADD package.json package-lock.json ./
RUN npm install --include=dev

# Setup production node_modules
FROM base AS production-deps

WORKDIR /myapp

COPY --from=deps /myapp/node_modules /myapp/node_modules
ADD package.json package-lock.json ./
RUN npm prune --omit=dev

# Build the app
FROM base AS build

WORKDIR /myapp

COPY --from=deps /myapp/node_modules /myapp/node_modules

ADD prisma .
RUN npx prisma generate

ADD . .

RUN npm run build

# Finally, build the production image with minimal footprint
FROM base

# Install openssl for Prisma
RUN apt-get update && apt-get install -y dumb-init

ENV NODE_ENV="production"

RUN groupadd --gid 1001 appgroup && useradd --uid 1001 --gid 1001 --create-home --shell /usr/sbin/nologin appuser
USER appuser

WORKDIR /myapp

COPY --chown=appuser:appgroup --from=production-deps /myapp/node_modules /myapp/node_modules
COPY --chown=appuser:appgroup --from=build /myapp/node_modules/.prisma /myapp/node_modules/.prisma

COPY --chown=appuser:appgroup --from=build /myapp/build /myapp/build
COPY --chown=appuser:appgroup --from=build /myapp/package.json /myapp/package.json
COPY --chown=appuser:appgroup --from=build /myapp/prisma /myapp/prisma

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD bash -c "echo > /dev/tcp/localhost/3000" || exit 1

EXPOSE 3000

CMD ["npm", "run", "start"]
