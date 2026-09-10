import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';

@Catch(UnauthorizedException)
export class OidcAuthRequiredFilter implements ExceptionFilter {
  catch(exception: UnauthorizedException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const pmsLoginUrl = process.env.PMS_LOGIN_URL ?? 'https://localhost:44367';

    const htmlContent = `
      <div style="padding: 2rem; font-family: system-ui; text-align: center;">
        <h1>Authentication Required</h1>
        <p>
          User is not authenticated. Please login from
          <a href="${pmsLoginUrl}" style="margin-left: 0.5rem;">Platform Management System</a>.
        </p>
      </div>`;

    res.status(HttpStatus.UNAUTHORIZED).send(htmlContent);
  }
}