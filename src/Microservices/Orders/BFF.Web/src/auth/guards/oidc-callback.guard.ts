import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OidcCallbackGuard extends AuthGuard('oidc') {
  handleRequest(err: any, user: any) {
    if (err || !user) {
      // GOTCHA: a DECLINED prompt=none attempt (error=login_required from the IDP) throws
      // here as a raw openid-client ClientError, not an HttpException. Without this guard
      // converting it, Nest has no idea what to do with it and returns a bare 500 instead
      // of a clean "not authenticated" response.
      
      throw new UnauthorizedException('Authentication failed or was declined by the IDP.');
    }
    return user;
  }
}