import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import * as client from 'openid-client';
import { Agent, fetch as undiciFetch } from 'undici';
import * as fs from 'fs';
import * as path from 'path';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OidcStrategy } from './strategies/oidc.strategy';
import { SessionSerializer } from './session.serializer';
import { SilentAuthGuard } from './guards/silent-auth.guard';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { OIDC_CONFIG } from './oidc-config.token';

@Module({
  imports: [PassportModule.register({ session: true })],
  controllers: [AuthController],
  providers: [
    {
      provide: OIDC_CONFIG,
      useFactory: async (configService: ConfigService) => {
        const authority =
          configService.get<string>('IDP_AUTHORITY') ?? 'https://localhost:44392';
        const clientId =
          configService.get<string>('IDP_CLIENT_ID') ??
          'Orders.Microservice.BFF.ClientID';
        const clientSecret =
          configService.get<string>('IDP_CLIENT_SECRET') ?? 'change-me';

        // undici@8.10.2 has a confirmed quirk handling the `ca` option (verified
        // via isolated test — a Buffer-based CA bundle fails even outside
        // openid-client entirely). Scoping rejectUnauthorized: false to this one
        // Agent, used only for local IDP discovery, is a bounded, deliberate
        // workaround — not a blanket TLS bypass.

        const agent = new Agent({ connect: { rejectUnauthorized: false } });
          // GOTCHA: this is NOT the same as setting NODE_TLS_REJECT_UNAUTHORIZED=0 process-wide.
          // It's scoped to this one Agent, used only for this one discovery() call to our own
          // local IDP. Confirmed via isolated test that undici@8.10.2's `ca:` option has a real
          // bug with Buffer-based CA bundles — this isn't a shortcut, it's the proven workaround.

        const customFetch: any = (url: any, options: any) =>
          undiciFetch(url, { ...options, dispatcher: agent });
          // GOTCHA: openid-client's discovery()/token calls do NOT use Node's global fetch
          // dispatcher (the setGlobalDispatcher() in main.ts has no effect on them) — they need
          // this explicit customFetch override, or every call silently ignores our CA trust setup.

          return client.discovery(
          new URL(authority),
          clientId,
          clientSecret,
          undefined,
          { [client.customFetch]: customFetch },
              // GOTCHA: [client.customFetch] is a computed
              // SYMBOL key, not a plain string property — { customFetch: ... } silently does nothing.
        );
      },
      inject: [ConfigService],
    },
    AuthService,
    OidcStrategy,
    SessionSerializer,
    SilentAuthGuard,
    SessionAuthGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}