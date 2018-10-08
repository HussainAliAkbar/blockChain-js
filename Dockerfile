FROM node:10.10.0-alpine

WORKDIR /app
ARG PORT

COPY package*.json ./
RUN npm install

# Install nodemon globally
RUN npm i nodemon -g

COPY . .

EXPOSE $PORT

CMD ["nodemon", "./src/index.js"]