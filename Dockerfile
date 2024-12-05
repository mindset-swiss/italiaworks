FROM node:20.12.2 as build

# Create Frontend Build
WORKDIR /home/node/app/sharetribe
COPY ./package.json ./
COPY ./yarn.lock ./
RUN yarn install
COPY . ./
RUN yarn run build

CMD [ "yarn", "start" ]