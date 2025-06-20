#!/bin/bash

# Update imports in TypeScript files
find app -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|~/components/settings/settings.types|~/settings/core/types|g'

# Update imports for specific components
find app -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|~/components/settings/|~/settings/tabs/|g' 