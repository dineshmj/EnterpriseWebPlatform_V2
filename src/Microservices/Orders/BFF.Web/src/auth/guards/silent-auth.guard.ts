// src/auth/guards/silent-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class SilentAuthGuard extends AuthGuard('oidc') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const returnUrl = (req.query.returnUrl as string) ?? '/';

    // If returnUrl is invalid, do NOT start OIDC here.
    // Let the controller handle showing the 404-ish HTML.
    if (!this.authService.isValidReturnUrl(returnUrl)) {
      return true;
    }

    // If already authenticated, don't trigger OIDC at all
    if (req.isAuthenticated && req.isAuthenticated()) {
      return true;
    }

    // NEW: Enforce that silent-login is only ever reached via the Shell
    // embedding this URL in its iframe — never a direct browser navigation.
    // Without this, a valid IDP SSO session would let ANY tab silently sign
    // in just by hitting this URL directly, bypassing the Shell entirely.
    if (req.headers['sec-fetch-dest'] !== 'iframe') {
      return true; // skip OIDC; controller's fallback HTML will show instead
    }

    // Store returnUrl in session for use after callback
    (req.session as any).returnUrl = returnUrl;

    // Let the base OIDC guard run (will trigger redirect to IDP with prompt=none)
    return (await super.canActivate(context)) as boolean;
  }

  // Add prompt=none to the OIDC authorize request
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const returnUrl = (req.query.returnUrl as string) ?? '/';

    return {
      prompt: 'none',
      state: returnUrl,
    };
  }
}