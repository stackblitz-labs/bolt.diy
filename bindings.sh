#!/bin/bash

bindings=""

# Function to extract variable names from the TypeScript interface
extract_env_vars() {
  grep -o '[A-Z_]\+:' worker-configuration.d.ts | sed 's/://'
}

# First try to read from .env.local if it exists
if [ -f ".env.local" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ ! "$line" =~ ^# ]] && [[ -n "$line" ]]; then
      name=$(echo "$line" | cut -d '=' -f 1)
      value=$(echo "$line" | cut -d '=' -f 2-)
      value=$(echo $value | sed 's/^"\(.*\)"$/\1/')
      bindings+="--binding ${name}=${value} "
    fi
  done < .env.local
else
  # If .env.local doesn't exist, use environment variables defined in .d.ts
  env_vars=($(extract_env_vars))
  # Generate bindings for each environment variable if it exists
  for var in "${env_vars[@]}"; do
    if [ -n "${!var}" ]; then
      bindings+="--binding ${var}=${!var} "
    fi
  done
fi

bindings=$(echo $bindings | sed 's/[[:space:]]*$//')

echo $bindings
