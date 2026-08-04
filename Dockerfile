# Single source of truth for the pinned toolchain image.
ARG NODE_IMAGE=node:24.18.0-bookworm-slim

# Toolchain stage: used by compose for install, lint, test, dev and preview.
# Dependencies are not baked in; Compose stores them in a named volume at /app/node_modules.
# NODE_ENV is deliberately unset so `npm run build` produces a real production bundle.
FROM ${NODE_IMAGE} AS dev
WORKDIR /app
RUN mkdir -p /app/node_modules && chmod 0777 /app/node_modules
ARG NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
ENV NPM_CONFIG_REGISTRY=${NPM_CONFIG_REGISTRY}
USER node
EXPOSE 5173 4173
CMD ["npm", "run", "dev"]

# Self-contained production build, useful for CI and image-based deployment.
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ARG NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
ENV NPM_CONFIG_REGISTRY=${NPM_CONFIG_REGISTRY}
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Static output only, so the build artefacts can be copied out or served by any web server.
FROM scratch AS dist
COPY --from=build /app/dist /
