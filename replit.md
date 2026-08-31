# Running the project on Replit

This is a Vite/TanStack React application.

## Development

Install dependencies after importing or cloning the project:

```sh
npm install
```

The Replit preview runs the app with:

```sh
npm run dev -- --host 0.0.0.0 --port 5000
```

The app is available through the Replit preview once the `Start application` workflow is running.

## MongoDB

The application uses the official MongoDB Node.js driver. Configure the MongoDB connection string as the server-only `MONGODB_URI` secret. The server verifies the connection when it starts and reuses a cached connection pool for database operations.

## VPS deployment

The production build is configured for a Node server and can be managed with PM2:

```sh
npm install
npm run build
pm2 start ecosystem.config.cjs
```

Set `MONGODB_URI` in the VPS environment before starting PM2. Do not commit the URI to the repository.

## Verification

The app has been verified on Replit with a successful production build using:

```sh
npm run build
```

`npm run lint` currently reports existing Prettier-formatting issues in the imported source; these do not prevent the development server or production build from starting.