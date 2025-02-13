FROM node:21-alpine as build

RUN apk add gcompat

# Install PNPM
RUN wget -qO /bin/pnpm "https://github.com/pnpm/pnpm/releases/latest/download/pnpm-linuxstatic-x64" && chmod +x /bin/pnpm

WORKDIR /usr/src/app/

# By doing this separate we allow Docker to cache this
COPY package.json pnpm-lock.yaml /usr/src/app/
RUN pnpm install

USER node
EXPOSE 3001

COPY ./src/ /usr/src/app/src/
COPY ./migrations/ /usr/src/app/migrations/
COPY ./scripts/ /usr/src/app/scripts/

CMD ["/bin/sh", "-c", "pnpm run migrate && pnpm run production"]
