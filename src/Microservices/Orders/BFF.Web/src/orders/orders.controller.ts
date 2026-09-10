import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { Console } from 'console';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly authService: AuthService) {}

  @Get('view-all')
  async getOrders(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
      res.set('Cache-Control', 'no-store');
      
      const accessToken = (req.session as any)?.AccessToken;

      console.log('Accessing getOrders with access token:', accessToken);

      console.log ("");
      console.log('Accessing getOrders with access token:', accessToken);
      console.log ("");

      if (!accessToken) {
        throw new HttpException(
          'Access token not found',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const ordersMicroserviceApiUrl = process.env.ORDERS_MICROSERVICE_API_URL;
      console.log ("");
      console.log ("Orders Microservice API base URL: " + ordersMicroserviceApiUrl);
      console.log ("");
      console.log ("Ensure that the port number shown in the above API URL is same as the one that IIS Express is hosting the Orders Microservice GraphQL API.");
      console.log ("If not, come to the .env file of this NestJS project, update the ORDERS_MICROSERVICE_API_URL value such that the port number matches with what IIS Express does.")
      console.log ("");

      const graphQLQuery = {
        query: '{ orderReport { nodes { orderId dateOfOrder totalAmount paymentMethod invoiceNumber numberOfItems dispatchStatus customerName } } }'
      };

      const response = await this.authService.callDownstreamApi(
        accessToken,
        `${ordersMicroserviceApiUrl}/graphql`,
        {
          method: 'POST',
          body: JSON.stringify(graphQLQuery),
        },
      );

      if (!response.ok) {
        throw new HttpException(
          'Failed to fetch order',
          response.status,
        );
      }

      return response.json();
  }

  @Get(':id')
  async getOrderById(@Param('id') id: string, @Req() req: Request) {
    try {
      const user = req.user as any;
      const accessToken = user?.tokens?.accessToken;

      if (!accessToken) {
        throw new HttpException(
          'Access token not found',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const ordersMicroserviceApiUrl = process.env.ORDERS_MICROSERVICE_API_URL;
      const response = await this.authService.callDownstreamApi(
        accessToken,
        `${ordersMicroserviceApiUrl}/api/orders/${id}`,
        { method: 'GET' },
      );

      if (!response.ok) {
        throw new HttpException(
          'Failed to fetch order',
          response.status,
        );
      }

      return response.json();
    } catch (error) {
      const message =
        error instanceof HttpException
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to fetch order';
      const status =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        message,
        status,
      );
    }
  }

  @Post()
  async createOrder(@Body() orderData: any, @Req() req: Request) {
    try {
      const user = req.user as any;
      const accessToken = user?.tokens?.accessToken;

      if (!accessToken) {
        throw new HttpException(
          'Access token not found',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const ordersMicroserviceApiUrl = process.env.ORDERS_MICROSERVICE_API_URL;
      const response = await this.authService.callDownstreamApi(
        accessToken,
        `${ordersMicroserviceApiUrl}/api/orders`,
        {
          method: 'POST',
          body: JSON.stringify(orderData),
        },
      );

      if (!response.ok) {
        throw new HttpException(
          'Failed to create order',
          response.status,
        );
      }

      return response.json();
    } catch (error) {
      const message =
        error instanceof HttpException
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to create order';
      const status =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        message,
        status,
      );
    }
  }
}