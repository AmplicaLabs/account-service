import { IsNotEmpty } from 'class-validator';

export class WalletLoginResponseDTO {
  @IsNotEmpty()
  accessToken: string;

  @IsNotEmpty()
  expires: number;

  @IsNotEmpty()
  msaId: string;

  @IsNotEmpty()
  handle: string;
}
