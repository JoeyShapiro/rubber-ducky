FROM node:alpine

# TODO maybe use bun as a builder image
# TODO maybe do some volume thing so i can do hot reloads

ADD build /app/build
WORKDIR /app
ADD package.json /app
ADD package-lock.json /app
ADD schema.js /app
ADD schema2.js /app

RUN npm install dotenv
RUN npm ci --omit dev

ENTRYPOINT [ "node", "build" ]
