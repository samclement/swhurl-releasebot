FROM node:10-alpine
RUN apk --no-cache add git \
  && git config --global user.email "sam@swhurl.com" \
  && git config --global user.name "releasebot"
WORKDIR /www
COPY . /www/
RUN npm i
USER node
CMD ["npm", "start"]
