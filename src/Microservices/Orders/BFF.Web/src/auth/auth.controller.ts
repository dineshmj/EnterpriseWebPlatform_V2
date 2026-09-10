import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  HttpStatus,
  UseFilters,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { SilentAuthGuard } from './guards/silent-auth.guard';
import { OidcCallbackGuard } from './guards/oidc-callback.guard';
import { OidcAuthRequiredFilter } from './filters/oidc-auth-required.filter';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('silent-login')
  @UseGuards(SilentAuthGuard)
  async silentLogin(
    @Query('returnUrl') returnUrl: string = '/',
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.authService.isValidReturnUrl(returnUrl)) {
      console.log('Invalid returnUrl detected in silent-login:', returnUrl);

      const htmlContent = `
        <div style='padding:20px; border:1px solid #d0d8e8; background:#f7faff; color:#1a2c4e; border-radius:8px; font-family:Segoe UI,Roboto,sans-serif; max-width:500px;'>
          <div style='display:flex; align-items:center; font-size:18px; font-weight:600; margin-bottom:10px;'>
            <span style='font-size:22px; margin-right:8px;'>&#x2757;</span>
            Microservice Task Not Implemented
          </div>
          <div style='font-size:14px; line-height:1.6; color:#2d3e5e;'>
            This microservice task has not been implemented yet. Please check back later or contact the service owner.
          </div>
        </div>`;

      return res.status(HttpStatus.NOT_FOUND).send(htmlContent);
    }

    // If already authenticated, go straight to SPA URL
    if (req.isAuthenticated && req.isAuthenticated()) {
      console.log('Silent login: user is already authenticated.');

      const spaUrl = `${process.env.NEXTJS_URL}${returnUrl}`;
      return res.redirect(spaUrl);
    }

    console.log('Silent login: presenting `Authentication Required` message.');

    // Fallback – should rarely hit if SilentAuthGuard is working
    const htmlContent = `
        <div style='padding:20px; border:1px solid #d0d8e8; background:#f7faff; color:#1a2c4e; border-radius:8px; font-family:Segoe UI,Roboto,sans-serif; max-width:500px;'>
          <div style='display:flex; align-items:center; font-size:18px; font-weight:600; margin-bottom:10px;'>
            <span style='font-size:22px; margin-right:8px;'>&#x2757;</span>
            Authentication Required
          </div>
          <div style='font-size:14px; line-height:1.6; color:#2d3e5e;'>
            Authentication is required to proceed with this operation.
          </div>
        </div>`;

    return res.status(HttpStatus.UNAUTHORIZED).send(htmlContent);
  }

  /**
   * OIDC Authentication endpoint (manual login, if ever needed)
   */
  @Get('oidc')
  @UseGuards(AuthGuard('oidc'))
  async oidcAuth(@Req() _req: Request) {
    // Guard will redirect to IDP
  }

  /**
   * OIDC Callback - Handles the callback from IDP after authentication
   * redirect_uri: https://localhost:33800/api/auth/callback
   */
  @Get('callback')
  @UseGuards(OidcCallbackGuard)
  @UseFilters(OidcAuthRequiredFilter)
  // @UseGuards(AuthGuard('oidc'))
  async oidcCallback(@Req() req: Request, @Res() res: Response) {
    // At this point, OIDC auth has succeeded and req.user is set for this request
    
    // Explicitly persist the user into our own session slot
    // so we can reliably read it later in guards/controllers
    (req.session as any).bffUser = req.user;

    // Explicitly persist the Access Token in the session as per legacy requirement
    const accessToken = (req.user as any)?.tokens?.accessToken;
    if (accessToken) {
      console.log('Storing access token in session for downstream API calls - ' + accessToken.substring(0, 10) + '...');
      (req.session as any).AccessToken = accessToken;
    }

    // Determine return URL (from session or state)
    const sessionReturnUrl = (req.session as any)?.returnUrl as
      | string
      | undefined;
    const stateReturnUrl = (req.query['state'] as string) || undefined;
    const returnUrl = sessionReturnUrl || stateReturnUrl || '/';

    // Clean up session temp data
    if (req.session) {
      delete (req.session as any).returnUrl;
    }

    // Build SPA URL and redirect
    const base = (process.env.NEXTJS_URL ?? '').replace(/\/+$/, '');
    const spaUrl = `${base}${returnUrl}`;

    return res.redirect(spaUrl);
  }

  /**
   * Silent Logout (POST) - Signs out the user from the BFF session
   */
  @Post('silent-logout')
  async silentLogoutPost(@Req() req: Request, @Res() res: Response) {
    (req.session as any).AccessToken = null;
    return this.handleSilentLogout(req, res);
  }

  /**
   * Silent Logout (GET) - Signs out the user from the BFF session
   */
  @Get('silent-logout')
  async silentLogoutGet(@Req() req: Request, @Res() res: Response) {
    (req.session as any).AccessToken = null;
    return this.handleSilentLogout(req, res);
  }

  private async handleSilentLogout(req: Request, res: Response) {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(HttpStatus.OK).json({
          success: true,
          message: 'User was not authenticated',
          alreadyLoggedOut: true,
        });
      }

      await new Promise<void>((resolve, reject) => {
        req.logout((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error('Session destroy error:', err);
          }
        });
      }

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Successfully logged out from Orders Microservice BFF',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Logout failed',
        error: error?.message ?? 'Unknown error',
      });
    }
  }

  /**
   * Auth Status - Returns current authentication status
   */
  @Get('status')
  async getAuthStatus(@Req() req: Request) {
    const user = (req.session as any)?.bffUser ?? (req.user as any);

    return {
      isAuthenticated: !!user,
      userName: user?.name,
      email: user?.email,
      claims: user?.claims || {},
    };
  }

  /**
   * Get Access Token - For internal use by BFF to call downstream APIs
   */
  @Get('access-token')
  async getAccessToken(@Req() req: Request) {
    const user = (req.session as any)?.bffUser ?? (req.user as any);

    if (!user?.tokens?.accessToken) {
      return {
        success: false,
        message: 'No access token available',
      };
    }

    return {
      success: true,
      accessToken: user.tokens.accessToken,
      expiresAt: user.tokens.expiresAt,
    };
  }
}