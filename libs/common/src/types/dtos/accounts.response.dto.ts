import type { HandleResponse } from '@frequency-chain/api-augment/interfaces';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';

export class AccountResponse {
  @ApiProperty()
  @IsNotEmpty()
  msaId: number;

  @ApiProperty()
  @IsOptional()
  handle?: HandleResponse | null;
}
