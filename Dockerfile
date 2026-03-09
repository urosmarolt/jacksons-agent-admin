FROM node:22-alpine
WORKDIR /app
RUN npm install -g pnpm@10.4.1
COPY package.json ./
RUN pnpm install --no-frozen-lockfile
COPY . .
EXPOSE 3003
CMD ["pnpm", "dev", "--host", "--port", "3003"]
