import { Controller, Get, Post, HttpCode, HttpStatus, Logger, Query, Body, Put } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WalletLoginResponseDTO } from '../../../../libs/common/src/dtos/wallet.login.response.dto';
import { WalletLoginRequestDTO } from '../../../../libs/common/src/dtos/wallet.login.request.dto';
import { ApiService } from '../services/api.service';

@Controller('api')
@ApiTags('account-service')
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

  @Get('accounts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request to create a new account' })
  @ApiOkResponse({ description: 'Account created successfully' })
  // @ApiBody({ type: AccountDTO })
  /**
   * Creates an account using the provided query parameters.
   * @param queryParams - The query parameters for creating the account.
   * @returns A promise that resolves to an array of AccountDTO objects representing the created accounts.
   * @throws An error if the account creation fails.
   */
  async createAccount(): Promise<String> {
    try {
      const account = await this.apiService.createAccount();
      // REMOVE:
      return account;
    } catch (error) {
      this.logger.error(error);
      throw new Error('Failed to create account');
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request to sign in with Frequency' })
  @ApiOkResponse({ description: 'Signed in successfully', type: WalletLoginResponseDTO })
  @ApiBody({ type: WalletLoginRequestDTO })
  async signInWithFrequency(@Body() walletLoginRequestDTO: WalletLoginRequestDTO): Promise<WalletLoginResponseDTO> {
    try {
      const loginResponse = await this.apiService.signInWithFrequency(walletLoginRequestDTO);
      // REMOVE:
      return loginResponse;
    } catch (error) {
      this.logger.error(error);
      throw new Error('Failed to sign in with Frequency');
    }
  }

  // // Create a provider graph
  // @Post('update-graph')
  // @HttpCode(HttpStatus.CREATED)
  // @ApiOperation({ summary: 'Request an update to given users graph' })
  // @ApiCreatedResponse({ description: 'Graph update request created successfully', type: GraphChangeRepsonseDto })
  // @ApiBody({ type: ProviderGraphDto })
  // async updateGraph(@Body() providerGraphDto: ProviderGraphDto): Promise<GraphChangeRepsonseDto> {
  //   try {
  //     return await this.apiService.enqueueRequest(providerGraphDto);
  //   } catch (error) {
  //     this.logger.error(error);
  //     throw new Error('Failed to update graph');
  //   }
  // }

  // @Put('watch-graphs')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Watch graphs for specified dsnpIds and receive updates' })
  // @ApiOkResponse({ description: 'Successfully started watching graphs' })
  // @ApiBody({ type: WatchGraphsDto })
  // async watchGraphs(@Body() watchGraphsDto: WatchGraphsDto) {
  //   try {
  //     // eslint-disable-next-line no-await-in-loop
  //     await this.apiService.watchGraphs(watchGraphsDto);
  //     return {
  //       status: HttpStatus.OK,
  //       data: 'Successfully started watching graphs',
  //     };
  //   } catch (error) {
  //     this.logger.error(error);
  //     throw new Error('Failed to watch graphs');
  //   }
  // }
}
