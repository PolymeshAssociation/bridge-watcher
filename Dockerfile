################################################################

FROM node:lts-alpine AS builder

################################################################

WORKDIR /home/node
USER node

################################################################

COPY --chown=node:node package.json package-lock.json /home/node/
RUN npm ci --ignore-scripts

################################################################

COPY --chown=node:node . /home/node/
RUN npm run build

################################################################

FROM node:lts-alpine

################################################################

RUN apk add --no-cache curl

################################################################

WORKDIR /home/node
USER node

################################################################

COPY --chown=node:node package.json package-lock.json /home/node/
RUN npm ci --ignore-scripts --omit=dev --omit=optional --omit=peer

################################################################

COPY --from=builder --chown=root:root /home/node/dist/ /home/node/
COPY --chown=root:root contracts/ /contracts/

################################################################

CMD ["node", "--unhandled-rejections=strict", "main.js", "watch"]

################################################################
