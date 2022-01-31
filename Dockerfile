FROM node:14

WORKDIR /honeycomb

COPY package.json .

RUN npm install

COPY . .

CMD ["node", "docker-start.js"]
