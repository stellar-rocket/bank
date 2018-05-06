FROM node:alpine
LABEL maintainer="contact@lunik.xyz"

ENV NODE_ENV=production

# Configurations
WORKDIR /usr/src/app

# Set config path
RUN mkdir /usr/config
ENV CONFIG_PATH=/usr/config/config.json

COPY ./build .
COPY package.json .

RUN apk --no-cache add --update make g++ python \
  && npm install \
  && apk del g++ python

# Expose ports
EXPOSE 3000

# expose volumes
VOLUME ["/usr/config"]

# start command
CMD ["/usr/local/bin/node", "./server.js"]
