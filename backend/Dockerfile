FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Les preuves photo sont persistées via un volume monté sur ce chemin
RUN mkdir -p /app/uploads/preuves && chown -R node:node /app
VOLUME ["/app/uploads"]

# Exécution en utilisateur non-root (image node officielle : utilisateur "node" déjà présent)
USER node

EXPOSE 3000
CMD ["node", "server.js"]
