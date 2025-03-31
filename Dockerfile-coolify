FROM node:20.18.0

WORKDIR /app

# Instalar pnpm e wrangler
RUN corepack enable pnpm && \
    npm install -g wrangler

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml ./

# Instalar dependências
RUN pnpm install

# Copiar código  fonte e scripts
COPY . .

# Garantir que o bindings.sh tem permissões de execução e formato correto
RUN tr -d '\r' < bindings.sh > bindings.tmp && \
    mv bindings.tmp bindings.sh && \
    chmod +x bindings.sh

# Build da aplicação
RUN pnpm run build

# Expor porta
EXPOSE 5173

# Configurar variáveis de ambiente
ENV NODE_ENV=production \
    RUNNING_IN_DOCKER=true

# Comando para iniciar usando o script dockerstart
CMD ["pnpm", "run", "dockerstart"]
