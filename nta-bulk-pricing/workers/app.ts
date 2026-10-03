import { createRequestHandler } from "react-router";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/__health") {
      try {
        const row = await env.DB
          .prepare("SELECT 1 AS ok")
          .first();

        return Response.json(
          {
            status: "ok",
            d1: row ? "ok" : "unknown",
          },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      } catch {
        return Response.json(
          {
            status: "unhealthy",
            d1: "error",
          },
          {
            status: 503,
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      }
    }

    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
