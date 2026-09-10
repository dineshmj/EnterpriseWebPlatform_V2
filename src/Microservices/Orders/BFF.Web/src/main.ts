import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import session from 'express-session';
import passport from 'passport';
import fs from 'fs';
// (reuse your existing `import fs from 'fs';` — no need for a second one)
import * as path from 'path';
import { Agent, setGlobalDispatcher } from 'undici';
import { csrfSync } from 'csrf-sync';

console.log('MAIN NODE_EXTRA_CA_CERTS:', process.env.NODE_EXTRA_CA_CERTS);
console.log('MAIN EXTRA CA COUNT:', require('tls').getCACertificates('extra').length);

const caBundle = fs.readFileSync(
  path.join(__dirname, '..', 'certs', 'extra-ca-bundle.pem'),
);

setGlobalDispatcher(
  new Agent({
    connect: {
      ca: caBundle,
      // Node does not use the Windows/OS cert store for its own outbound calls by default — completely separate trust store from what the browser was just fixed to trust.
    },
  }),
);

async function bootstrap() {
  const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, '..', 'certs', 'localhost.key')),
    cert: fs.readFileSync(path.join(__dirname, '..', 'certs', 'localhost.crt')),
  };
  
  const app = await NestFactory.create(AppModule, {
    httpsOptions,
  });

  // Enable CORS for the NextJS frontend
  app.enableCors({
    origin: [process.env.NEXTJS_URL, process.env.SHELL_ORIGIN],
      // GOTCHA: NEXTJS_URL alone was the original setting and looked sufficient for months —
      // it only covers this BFF's own SPA. SHELL_ORIGIN is required separately because the
      // Shell calls silent-logout on THIS BFF cross-origin; without it, that call either
      // gets CORS-blocked outright or (for "simple" requests) reaches the server fine but
      // the Shell's JS is blocked from ever reading the response.
    // If Shell URL is not specified here, it will cause CORS error when Shell attempts to perform silet-logout on behalf of the user, because the Shell is not same-origin with the BFF.
    credentials: true,
  });

  // CSRF protection (Synchronizer Token Pattern) — relies on req.session, so must be
  // initialized after express-session, and mounted after it in the middleware chain below.
  const { csrfSynchronisedProtection } = csrfSync();

  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      proxy: true, // Allow secure cookies behind proxy

      cookie: {
        httpOnly: true,
        secure: true,      // Required for SameSite=None
        sameSite: 'none',  // Required for rendering within iFrame of the shell application.
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    }),
  );

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Enforce CSRF protection on all state-changing requests from here on
  app.use((req: any, res: any, next: any) => {
    if (req.path === '/api/auth/silent-logout') {
      return next();
        // GOTCHA: CSRF only checks non-GET/HEAD/OPTIONS methods by default —
        // this route is a POST, so it WAS being silently 403'd here for
        // months before anyone noticed, because the failure looked identical
        // to "logout just didn't happen" rather than an explicit error.
          // Logout is exempt: forcing a logout via CSRF is a nuisance-level
          // risk, not a data-integrity one, and doesn't warrant blocking it
          // until the full token-issuing endpoint exists for real mutations.
    }
    return csrfSynchronisedProtection(req, res, next);
  });

  const port = Number (process.env.PORT);
  await app.listen(port);
  console.log(`🚀 Orders BFF is running on: https://localhost:${port}`);
}

bootstrap();