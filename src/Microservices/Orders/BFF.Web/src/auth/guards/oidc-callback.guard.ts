import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OidcCallbackGuard extends AuthGuard('oidc') {
  handleRequest(err: any, user: any) {
    if (err || !user) {
      // Covers a declined prompt=none attempt (error=login_required) and
      // any other auth failure — treat all of these as "not authenticated"
      // rather than letting the raw openid-client error become a 500.
      throw new UnauthorizedException('Authentication failed or was declined by the IDP.');
    }
    return user;
  }
}