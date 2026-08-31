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

## Verification

The app has been verified on Replit with a successful production build using:

```sh
npm run build
```

`npm run lint` currently reports existing Prettier-formatting issues in the imported source; these do not prevent the development server or production build from starting.