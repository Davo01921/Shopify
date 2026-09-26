import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ status: "unhealthy" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
