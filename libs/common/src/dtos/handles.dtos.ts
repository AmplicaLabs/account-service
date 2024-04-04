import { HexString } from '@polkadot/util/types';
import { IsNotEmpty } from 'class-validator';
import { AccountWithHandle } from './accounts.dto';

export class HandlesRequest {
  msaId: string;
  baseHandle: string;
  // @IsNotEmpty()
  // pallet: string;

  // @IsNotEmpty()
  // ectrinsicName: string;

  // @IsNotEmpty()
  // encodedExtrinsic: HexString;
}

export type HandlesResponse = AccountWithHandle;
