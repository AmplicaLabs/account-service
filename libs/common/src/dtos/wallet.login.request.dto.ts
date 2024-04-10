import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class WalletLoginRequestDTO {
  @ApiProperty({
    description: 'The wallet login request information',
    type: 'object',
    example: {
      siwsPayload: {
        message: '0x1234567890abcdef',
        signature: '0x1234567890abcdef',
      },
      error: {
        message: 'Error message',
      },
    },
    properties: {
      siwsPayload: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The message',
          },
          signature: {
            type: 'string',
            description: 'The signature',
          },
        },
      },
      error: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The error message',
          },
        },
      },
    },
  })
  signIn: {
    siwsPayload: {
      message: string;
      signature: string;
    };
    error: {
      message: string;
    };
  };

  @ApiProperty({
    example: '0x1234567890abcdef',
    description: 'The public',
  })
  signUp: {
    extrinsics: {
      pallet: string;
      extrinsicName: string;
      encodedExtrinsic: string;
    }[];
    error?: {
      message: string;
    };
  };
}
