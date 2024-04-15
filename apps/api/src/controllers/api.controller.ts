import { Controller, Get, Post, HttpCode, HttpStatus, Logger, Query, Body, Put, HttpException } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WalletLoginResponseDTO } from '../../../../libs/common/src/types/dtos/wallet.login.response.dto';
import { WalletLoginRequestDTO } from '../../../../libs/common/src/types/dtos/wallet.login.request.dto';
import { ApiService } from '../services/api.service';

@Controller('api')
@ApiTags('api')
export class ApiController {
  private readonly logger: Logger;

  constructor(private apiService: ApiService) {
    this.logger = new Logger(this.constructor.name);
  }

  // Health endpoint
  // eslint-disable-next-line class-methods-use-this
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check the health status of the service' })
  @ApiOkResponse({ description: 'Service is healthy' })
  health() {
    return {
      status: HttpStatus.OK,
      message: 'Service is healthy',
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request to sign in with Frequency' })
  @ApiOkResponse({ description: 'Signed in successfully', type: WalletLoginResponseDTO })
  @ApiBody({ type: WalletLoginRequestDTO })
  async signInWithFrequency(
    @Body() walletLoginRequestDTO: WalletLoginRequestDTO,
  ): Promise<WalletLoginResponseDTO | Response> {
    try {
      this.logger.log('Received Sign-In With Frequency request');
      this.logger.debug(`walletLoginRequestDTO: ${JSON.stringify(walletLoginRequestDTO)}`);
      const loginResponse = await this.apiService.signInWithFrequency(walletLoginRequestDTO);
      // return { status: 202, message: `SIWF in progress. referenceId: ${referenceId}`, data: loginResponse };
      return loginResponse;
    } catch (error) {
      this.logger.error(`Failed to Sign In With Frequency: ${error}`);
      throw new HttpException('Failed to Sign In With Frequency', HttpStatus.BAD_REQUEST);
    }
  }
}
