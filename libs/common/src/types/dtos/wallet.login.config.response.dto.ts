import { RequestedSchema, SiwsOptions } from '@amplica-labs/siwf';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';

export class WalletLoginConfigResponse {
  @ApiProperty()
  @IsNotEmpty()
  providerId: string;

  @ApiProperty()
  @IsNotEmpty()
  proxyUrl: string;

  @ApiProperty()
  @IsNotEmpty()
  frequencyRpcUrl: string;

  @ApiProperty()
  @IsNotEmpty()
  schemas: RequestedSchema[];

  @ApiProperty()
  @IsOptional()
  siwsOptions?: SiwsOptions;
}
