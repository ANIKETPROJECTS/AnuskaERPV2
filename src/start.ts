import {
  createStart,
  createCsrfMiddleware,
  createMiddleware,
  createIsomorphicFn,
} from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { verifyMongoConnection } from "./mongodb.server";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const verifyMongoConnectionByEnvironment = createIsomorphicFn()
  .client(() => Promise.resolve())
  .server(async () => {
    await verifyMongoConnection();
    console.info("[mongodb] connection established");
  });

void verifyMongoConnectionByEnvironment()
  .catch(() => {
    console.error("[mongodb] connection failed; check MONGODB_URI and MongoDB network access.");
  });

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
