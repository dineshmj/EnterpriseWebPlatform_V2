import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'openid-client/passport';
import type { Configuration } from 'openid-client';
import { ConfigService } from '@nestjs/config';
import { OIDC_CONFIG } from '../oidc-config.token';

@Injectable()
export class OidcStrategy extends PassportStrategy(Strategy, 'oidc') {
  constructor(
    @Inject(OIDC_CONFIG) config: Configuration,
    configService: ConfigService,
  ) {
    const callbackUrl =
      configService.get<string>('IDP_CALLBACK_URL') ??
      'https://localhost:33800/api/auth/callback';
    const scopes =
      configService.get<string>('IDP_SCOPES') ??
      'openid profile email orders_api';

    super({
      config,
      scope: scopes,
      callbackURL: callbackUrl,
      passReqToCallback: false,
        // GOTCHA: no authorizationRequestParams() override needed here — it's tempting to add
        // one to forward `prompt`, but the base Strategy ALREADY auto-forwards prompt, scope,
        // loginHint, idTokenHint, resource, and authorizationDetails from AuthenticateOptions.
        // An override here would be redundant at best, and its exact signature (2 args, not 1)
        // is easy to get wrong.
    });
  }

  /**
   * NestJS's PassportStrategy wrapper handles the `done` callback itself —
   * you just return the user (or throw) here. Keeping two parameters
   * (tokens, userinfo) preserves your original behavior of fetching the
   * userinfo endpoint, same as before.
   */
  async validate(tokens: any, userinfo: any): Promise<any> {
    return {
      id: userinfo.sub,
      email: userinfo.email,
      name: userinfo.name,
      claims: userinfo,
      tokens: {
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_at,
      },
    };
  }
}