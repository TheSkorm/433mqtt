FROM debian:latest

ENV LANG C.UTF-8

RUN apt-get update; apt-get install -y nodejs npm git python2 build-essential
RUN mkdir /433mqtt
COPY config.default.json /433mqtt/
COPY package.json /433mqtt/
COPY index.js /433mqtt/

WORKDIR /433mqtt
RUN npm install

WORKDIR /

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
