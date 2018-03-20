ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8

RUN apk add --update nodejs nodejs-npm git python
RUN apk add --update make gcc g++ linux-headers udev
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