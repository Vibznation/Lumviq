# Devcontainer Dockerfile for Lumviq
FROM mcr.microsoft.com/devcontainers/typescript-node:0-20

# Avoid interactive tzdata prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install system packages useful for building and DB tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    unzip \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Enable corepack (for pnpm) and install pnpm
RUN corepack enable \
  && corepack prepare pnpm@latest --activate

# Install Prisma CLI and Supabase CLI globally
RUN npm install -g prisma@latest supabase

# Create workspace folders and ensure correct ownership for vscode user
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN mkdir -p /workspace && chown -R ${USERNAME}:${USERNAME} /workspace
WORKDIR /workspace

# Switch back to vscode user (base image already sets this, but ensure it)
USER ${USERNAME}

# Default command
CMD ["sleep", "infinity"]
