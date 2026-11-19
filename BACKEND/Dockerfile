# Node 22 LTS (Node 18 sin soporte desde abril 2025 - mantenimiento preventivo EV3)
FROM node:22-alpine

WORKDIR /app

# Dependencias exactas del lockfile, sin las de desarrollo
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src/ ./src/
COPY sql/ ./sql/
COPY uploads/ ./uploads/
RUN mkdir -p uploads/contracts && chown -R node:node /app/uploads

# Principio de minimo privilegio: el proceso no corre como root (CIS Docker 4.1)
USER node

EXPOSE 4000
CMD ["node", "src/app.js"]
