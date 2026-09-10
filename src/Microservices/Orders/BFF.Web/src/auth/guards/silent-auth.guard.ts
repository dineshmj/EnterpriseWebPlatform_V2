/**
 * Enforces the "silent login" contract for this BFF:
 *
 * 1. Silent login must ONLY be triggered by the Shell app embedding this
 *    URL in its iframe — never by a user directly navigating here. We
 *    detect this via the browser-supplied `Sec-Fetch-Dest` header, which
 *    is `iframe` for embedded navigations and `document` for a typed URL
 *    / clicked link / new tab. Without this check, anyone with a valid
 *    IDP SSO session could silently sign in to Orders just by opening
 *    this URL directly, bypassing the Shell entirely.
 *
 * 2. When silent login IS legitimately triggered, we request `prompt=none`
 *    from the IDP (see getAuthenticateOptions below) — this tells the IDP
 *    "don't show any UI; succeed quietly if the user's already logged in
 *    elsewhere, fail quietly (error=login_required) otherwise." That
 *    failure is what OidcCallbackGuard converts into a clean
 *    "Authentication Required" page instead of a raw exception.
 */

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
        // GOTCHA: this header is set automatically by the BROWSER, not by our code —
        // 'iframe' only when this URL loads as an <iframe src>, 'document' for any
        // direct navigation (typed URL, bookmark, new tab). This is what stops a
        // valid IDP SSO session from silently signing in ANY tab that hits this URL.
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
        // GOTCHA: must be a FLAT key here, not nested as { params: { prompt: 'none' } }.
        // The old openid-client v5 base class merged nested `params` automatically;
        // v6's Strategy silently ignores it if nested — no error, it just quietly
        // stops being "silent" and falls back to showing the IDP's login page.
      state: returnUrl,
    };
  }
}