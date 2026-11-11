# Atelier Commerce

A configurable, full-stack multi-category store built with React, TypeScript, Vite, Express, and MongoDB/Mongoose. The repo includes the customer storefront, account and order flows, REST API, payment verification, inventory logic, and a role-protected admin dashboard.

## Run locally

### Quick preview

Install Node.js 20 or newer, then run:

```bash
npm install
npm run dev:preview
```

Open `http://localhost:5173`. This preview starts the API on `http://localhost:4000/api`, creates a local in-memory MongoDB, and seeds sample catalog data. Preview changes disappear when the process stops. It is useful for reviewing the UI and exercising the main flows; use a persistent database for regular development.

### Persistent development database

1. Copy `.env.example` to `server/.env` and configure `MONGODB_URI` and a long, random `JWT_SECRET`.
2. Run `npm run seed` to add or update sample categories and products.
3. Run `npm run dev` to start the Vite client and Express API.

To create a development administrator, set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and optionally `SEED_ADMIN_NAME` in `server/.env` before running the seed command. The password is hashed before it is stored. There is no public administrator signup route.

## Storefront and admin features

- Responsive home, shop, category, search, product, wishlist, cart, checkout, account, order, information, and not-found pages.
- Catalog search, suggestions, category and subcategory filters, price and rating filters, stock filtering, sorting, and pagination backed by MongoDB.
- Guest cart and wishlist persistence; signed-in carts and wishlists sync through the API.
- Registration, login, logout, password reset, account profile, and saved shipping addresses. Sessions use signed HTTP-only cookies.
- Server-calculated discounts, tax, shipping, and totals; stock is reserved and checked on the server before checkout.
- Cash on delivery and Razorpay checkout support. Razorpay payment signatures are verified on the server, and signed webhooks track refund completion.
- Order history, cancellation, shipping updates, tracking links, and review eligibility based on delivered purchases.
- Admin overview and analytics, product and category management, customer and order views, coupon and banner management, review moderation, image upload, and stock reporting.

## Optional integrations

- **Razorpay:** set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on the server to enable online checkout. Use test credentials first. Configure a Razorpay webhook to `https://your-api-origin/api/webhooks/razorpay` with the `refund.processed` and `refund.failed` events, then set its signing secret as `RAZORPAY_WEBHOOK_SECRET`. The browser callback alone never marks a payment successful.
- **Cloudinary:** set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to enable the authenticated admin image uploader. Product images can also be managed with hosted image URLs.
- **Email:** configure the SMTP variables in `server/.env` to deliver password-reset links. Without SMTP, reset links are only logged in non-production environments.

Cash on delivery remains available when Razorpay is not configured. The app intentionally contains no production payment, mail, image-hosting, or database credentials.

## Environment configuration

The API reads `server/.env` or its process environment. Configure the store name, logo, colors, currency, tax rate, shipping amount, free-shipping threshold, and customer contact details there. Keep `CLIENT_URL` limited to the exact storefront origin(s); set `COOKIE_SECURE=true` and use HTTPS in production. Use a managed MongoDB deployment with backups, a unique production `JWT_SECRET`, and production Razorpay/Cloudinary credentials kept only on the server.

For a single-origin deployment, build the client with `npm run build`, then run the server with `NODE_ENV=production npm start`; the Express app serves `client/dist` and the `/api` routes together. Configure the production environment before starting it. If the storefront is hosted separately, set `VITE_API_URL` at client build time and set `CLIENT_URL` to its exact origin on the API.

## Free preview hosting on Koyeb

This repository can also run as one full-stack service on Koyeb. The free instance is intended for previews and hobby projects, not a production store: it has 512 MB RAM and 0.1 vCPU, and sleeps after an hour without traffic. It receives a `*.koyeb.app` URL; a `.com` domain is separate and is not included.

1. In Koyeb, create a Web Service from `github.com/dhruv84887/e`, branch `main`. Keep the work directory at the repository root and use the buildpack builder.
2. Set the build command to `npm ci --include=dev && npm run build`. The root `Procfile` starts the API and built storefront with `npm start`.
3. Configure these service environment variables. Enter secrets directly in Koyeb, never in GitHub:

   - `NODE_ENV=production`
   - `MONGODB_URI` — the MongoDB Atlas application user's URI
   - `JWT_SECRET` — a unique random value of at least 32 characters
   - `CLIENT_URL=https://{{ KOYEB_PUBLIC_DOMAIN }}`
   - `COOKIE_SECURE=true`
   - `COOKIE_SAME_SITE=lax`
   - `STORE_NAME=Atelier`
   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and optionally `SEED_ADMIN_NAME`

4. In MongoDB Atlas, add the current outbound addresses for the chosen Koyeb region to Network Access. Koyeb does not guarantee static outbound IPs; its published pool can change, so an Atlas allowlist may need maintenance. Keep database authentication enabled and do not use `0.0.0.0/0` as a shortcut.
5. After the first deployment is healthy, seed the starter catalog and initial administrator once from an authenticated Koyeb CLI session: `koyeb services exec <service-name> --app <app-name> -- npm run seed`. Do not add this to the recurring start command.
6. Open the `*.koyeb.app` URL and confirm `/api/health` reports `database: "connected"`. Sign in at `/login` with the administrator account configured above.

Cash on delivery works without gateway credentials. Add Razorpay test credentials, Cloudinary credentials, and SMTP settings as protected environment variables only when those integrations are needed. The free Koyeb instance can be slow after waking from sleep; use a paid, always-on plan and proper operational monitoring before accepting real customer orders.

## Public preview hosting on Render

This repository includes a Render Blueprint for a single-origin storefront and API. It builds the client, starts the Express server, configures HTTPS cookies and same-origin requests, checks `/api/health`, generates a server-only JWT secret, and seeds the starter catalog after the first successful deploy.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/dhruv84887/e)

Before deploying, create a persistent MongoDB database (for example, a MongoDB Atlas cluster) and make sure its network access rules allow the Render service to connect. During Blueprint setup, provide the database connection string as `MONGODB_URI`, plus the first administrator's email and a strong unique password as `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. Enter those values in Render's secret fields; do not commit them or paste them into source files. The Blueprint creates the admin and starter products once after the first deploy. The `CLIENT_URL` is linked to Render's generated service URL, so no separate frontend host is needed.

The Blueprint uses Render's free web-service plan to avoid starting a paid service. Render's free services can spin down when idle, and Render says free instances are for previews rather than production. Upgrade the service to a paid plan before relying on it for a live store. Configure SMTP for password-reset email, Razorpay test credentials for online payments, and Cloudinary credentials for admin image uploads as needed. Cash on delivery and externally hosted product image URLs work without those optional integrations.

After deployment, open the service URL and confirm `/api/health` reports `database: "connected"`; then sign in to `/login` using the administrator credentials configured in Render.

## Verify changes

```bash
npm test
npm run build
```

The API suite uses an isolated in-memory MongoDB. It covers health/config, validation, password hashing and cookie auth, admin access, saved addresses, catalog filters, cart/coupons, checkout inventory rollback, COD delivery, review verification and moderation, Razorpay signature verification, refund webhook signatures, cancellation, late-payment rejection, and analytics. Razorpay gateway calls are not made by the test suite.

## Project layout

- `client/` — React storefront, customer account, admin interface, shared components, and API client.
- `server/` — Express routes/controllers, Mongoose models, input validation, auth/security middleware, and payment/refund services.
- `README.md` and `.env.example` — setup, integration, and configuration guidance.

## API overview

Public catalog and store endpoints live under `/api/products`, `/api/categories`, `/api/config`, `/api/banners`, `/api/reviews`, and `/api/newsletter`. Customer routes cover `/api/auth`, `/api/cart`, `/api/wishlist`, `/api/orders`, `/api/coupons`, and `/api/payments`. Administrators use `/api/admin`; the signed Razorpay refund webhook uses `/api/webhooks/razorpay`.
