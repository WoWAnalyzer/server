FROM node:11.11-alpine as build

WORKDIR /usr/src/app/
ENV NODE_ENV=production

# By doing this separate we allow Docker to cache this
COPY package.json package-lock.json /usr/src/app/
RUN npm ci --dev

COPY . /usr/src/app/
RUN npm run build
RUN npm prune --production

FROM node:10.12-alpine

WORKDIR /usr/src/app/
ENV NODE_ENV=production

COPY --from=build /usr/src/app/build/ /usr/src/app/
COPY --from=build /usr/src/app/node_modules/ /usr/src/app/node_modules/
COPY --from=build /usr/src/app/migrations/ /usr/src/app/migrations/
COPY package.json /usr/src/app/

USER node
EXPOSE 3001

CMD node --harmony node_modules/sequelize-cli/lib/sequelize db:migrate --config config/database.js && node --harmony index.js
