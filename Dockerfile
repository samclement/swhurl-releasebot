FROM node:8-alpine
WORKDIR /www
COPY . /www/
RUN apk --no-cache add git \
  && git config --global user.email "sam@swhurl.com" \
  && git config --global user.name "releasebot" \
  && npm i
CMD ["npm", "start"]
