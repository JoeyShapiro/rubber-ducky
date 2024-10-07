FROM node:alpine

ADD build /app/build
WORKDIR /app
ADD package.json /app
ADD package-lock.json /app
ADD schema.js /app

RUN npm install dotenv
RUN npm ci --omit dev

ENTRYPOINT [ "node", "build" ]
