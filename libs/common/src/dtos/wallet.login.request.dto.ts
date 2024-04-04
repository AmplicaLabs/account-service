import { IsNotEmpty } from 'class-validator';

export class WalletLoginRequestDTO {
  signIn: {
    siwsPayload: {
      message: string;
      signature: string;
    };
    error: {
      message: string;
    };
  };

  signUp: {
    extrinsics: [
      {
        pallet: string;
        extrinsicName: string;
        encodedExtrinsic: string;
      },
    ];
    error: {
      message: string;
    };
  };
}
