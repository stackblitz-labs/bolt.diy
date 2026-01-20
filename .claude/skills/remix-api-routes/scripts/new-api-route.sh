#!/bin/bash
# Generate a new Remix API route with security wrapper and Zod validation
# Usage: ./new-api-route.sh <route-name> [--streaming]
#
# Examples:
#   ./new-api-route.sh my-service           # Creates api.my-service.ts
#   ./new-api-route.sh my-service --streaming  # Creates with SSE streaming

set -e

ROUTE_NAME="${1:-}"
STREAMING="${2:-}"

if [ -z "$ROUTE_NAME" ]; then
  echo "Usage: $0 <route-name> [--streaming]"
  echo "Example: $0 my-service"
  exit 1
fi

# Determine project root (assumes script is in .claude/skills/remix-api-routes/scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
ROUTES_DIR="$PROJECT_ROOT/app/routes"
OUTPUT_FILE="$ROUTES_DIR/api.${ROUTE_NAME}.ts"

if [ -f "$OUTPUT_FILE" ]; then
  echo "Error: $OUTPUT_FILE already exists"
  exit 1
fi

if [ "$STREAMING" = "--streaming" ]; then
  # SSE Streaming template
  cat > "$OUTPUT_FILE" << 'EOF'
import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { z } from 'zod';
import { withSecurity, sanitizeErrorMessage } from '~/lib/security';

// Request validation schema
const RequestSchema = z.object({
  // Define your request fields here
  input: z.string().min(1),
});

export const action = withSecurity(
  async ({ request }: ActionFunctionArgs) => {
    // Validate request body
    const body = await request.json();
    const result = RequestSchema.safeParse(body);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: true, message: 'Validation failed', details: result.error.flatten() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Heartbeat to prevent Cloudflare 30s timeout
        const heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        }, 5000);

        try {
          // TODO: Implement your streaming logic here
          // Example:
          // for await (const chunk of generateContent(result.data)) {
          //   controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          // }

          // Send completion
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          const message = sanitizeErrorMessage(error, process.env.NODE_ENV === 'development');
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: true, message })}\n\n`));
        } finally {
          clearInterval(heartbeat);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  },
  { allowedMethods: ['POST'] }
);
EOF

else
  # Standard JSON template
  cat > "$OUTPUT_FILE" << 'EOF'
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { z } from 'zod';
import { withSecurity, sanitizeErrorMessage } from '~/lib/security';

// Request validation schema
const RequestSchema = z.object({
  // Define your request fields here
  name: z.string().min(1).max(100),
});

// GET handler
export const loader = withSecurity(
  async ({ request, params }: LoaderFunctionArgs) => {
    try {
      // TODO: Implement your GET logic here
      return json({ success: true, data: {} });
    } catch (error) {
      const message = sanitizeErrorMessage(error, process.env.NODE_ENV === 'development');
      return json({ error: true, message }, { status: 500 });
    }
  },
  { allowedMethods: ['GET'] }
);

// POST handler
export const action = withSecurity(
  async ({ request }: ActionFunctionArgs) => {
    // Validate request body
    const body = await request.json();
    const result = RequestSchema.safeParse(body);

    if (!result.success) {
      return json(
        { error: true, message: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      );
    }

    try {
      // TODO: Implement your POST logic here
      return json({ success: true, data: result.data }, { status: 201 });
    } catch (error) {
      const message = sanitizeErrorMessage(error, process.env.NODE_ENV === 'development');
      return json({ error: true, message }, { status: 500 });
    }
  },
  { allowedMethods: ['POST'] }
);
EOF

fi

echo "Created: $OUTPUT_FILE"
echo ""
echo "Next steps:"
echo "  1. Define your Zod schema fields"
echo "  2. Implement the handler logic"
echo "  3. Add tests in test/routes/api.${ROUTE_NAME}.test.ts"
