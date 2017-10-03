FROM node:8.1.4

WORKDIR /app
ADD . /app
RUN rm .env

RUN yarn install

EXPOSE 9292

HEALTHCHECK --interval=10s --timeout=3s CMD curl --fail http://localhost:9292/ping || exit 1

CMD ["yarn", "run", "start"]
