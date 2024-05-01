import { BlockHash, Hash } from '@polkadot/types/interfaces';
import { PublishHandleRequest } from './handles.request.dto';
import { PublishSIWFSignupRequest } from './wallet.login.request.dto';
import { PublishKeysRequest } from './keys.request.dto';

export type TransactionData<RequestType = PublishHandleRequest | PublishSIWFSignupRequest | PublishKeysRequest> =
  RequestType & {
    providerId: number;
    referenceId: string;
  };

export type TxMonitorJob = TransactionData & {
  id: string;
  txHash: Hash;
  epoch: string;
  lastFinalizedBlockHash: BlockHash;
};

type TxWebhookRspBase<RequestType> = {
  transactionType: RequestType;
  providerId: TransactionData['providerId'];
  referenceId: TransactionData['referenceId'];
  msaId: string;
};

export type PublishHandleOpts = { handle: string };
export type SIWFOpts = { handle: string; accountId: string; providerId: TransactionData['providerId'] };
export type PublishKeysOpts = { newPublicKey: string };
export type TxWebhookOpts = PublishHandleOpts | SIWFOpts | PublishKeysOpts;

export type PublishHandleWebhookRsp = TxWebhookRspBase<PublishHandleRequest['type']> & PublishHandleOpts;
export type SIWFWebhookRsp = TxWebhookRspBase<PublishSIWFSignupRequest['type']> & SIWFOpts;
export type PublishKeysWebhookRsp = TxWebhookRspBase<PublishKeysRequest['type']> & PublishKeysOpts;
export type TxWebhookRsp = PublishHandleWebhookRsp | SIWFWebhookRsp | PublishKeysWebhookRsp;
