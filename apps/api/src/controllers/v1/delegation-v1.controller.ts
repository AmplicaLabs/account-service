import { DelegationService } from '#api/services/delegation.service';
import { DelegationResponse } from '#lib/types/dtos/delegation.response.dto';
import { Controller, Get, HttpCode, HttpException, HttpStatus, Logger, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller('v1/delegation')
@ApiTags('v1/delegation')
export class DelegationControllerV1 {
  private readonly logger: Logger;

  constructor(private delegationService: DelegationService) {
    this.logger = new Logger(this.constructor.name);
  }

  // Delegation endpoint
  @Get(':msaId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the delegation information associated with an msaId.' })
  @ApiOkResponse({ description: 'Found delegation information.' })
  async getDelegation(@Param('msaId') msaId: string): Promise<DelegationResponse> {
    try {
      const delegation = await this.delegationService.getDelegation(msaId);
      return delegation;
    } catch (error) {
      this.logger.error(error);
      throw new HttpException('Failed to find the delegation', HttpStatus.BAD_REQUEST);
    }
  }
}
