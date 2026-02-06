FROM jenkins/inbound-agent:alpine-jdk17

# Install Node.js and required tools
RUN apk add --no-cache \
    nodejs \
    npm \
    git \
    curl \
    docker \
    docker-cli-compose \
    bash \
    openssl \
    ca-certificates \
    && apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/v3.19/community \
    nodejs-current \
    npm

# Install specific Node.js version
ENV NODE_VERSION=20
ENV NVM_DIR=/usr/local/nvm

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm use $NODE_VERSION \
    && nvm alias default $NODE_VERSION

# Install pnpm globally
RUN . $NVM_DIR/nvm.sh && npm install -g pnpm@9

# Set Node.js paths
ENV PATH=$NVM_DIR/versions/node/v${NODE_VERSION}/bin:$PATH

# Create workspace directory
RUN mkdir -p /home/jenkins/agent/workspace

# Set working directory
WORKDIR /home/jenkins/agent

# Default command
CMD ["sh"]

