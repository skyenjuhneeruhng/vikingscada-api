FROM node:8.11.2-alpine
#FROM node:7.5.0-alpine
MAINTAINER yuriy.hertsyuk@indeema.com

ARG NODE_ENV
ARG SERVICE
ENV NODE_ENV "$NODE_ENV"
ENV SERVICE "$SERVICE"

# set default workdir
RUN mkdir -p /usr/vikings
WORKDIR /usr/vikings


#COPY core core
#COPY config config
#COPY models models
RUN mkdir node_modules
COPY app app
COPY views views
#COPY node_modules node_modules
#COPY node_modules node_modules

COPY package.json package.json
COPY webpack.config.js webpack.config.js

#RUN npm i npm@latest -g

RUN npm install

# RUN ls -al
# RUN cat package.json

#RUN npm list --depth=0
#RUN ls -al
#RUN cd node_modules && ls -al

EXPOSE 8080
#CMD ["node", "app/babel-server.js"]
CMD ["npm", "start"]