FROM node:20-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

COPY server ./server
COPY index.html ./index.html
COPY admin.html ./admin.html
COPY styles.css ./styles.css
COPY scripts ./scripts
COPY favicon.svg ./favicon.svg
COPY robots.txt ./robots.txt
COPY sitemap.xml ./sitemap.xml

EXPOSE 3000

WORKDIR /app/server
CMD ["node", "server.js"]
