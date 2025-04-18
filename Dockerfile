FROM node:22.14.0-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY . .
COPY public .

EXPOSE 3002

CMD ["npm","start"]