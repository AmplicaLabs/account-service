import { BlockHash, Hash } from '@polkadot/types/interfaces';
import { PublishHandleRequest } from './handles.request.dto';
import { PublishSIWFSignupRequest } from './wallet.login.request.dto';
import { PublishKeysRequest } from './keys.request.dto';
import { TransactionType } from '../enums';

export type TransactionData<RequestType = PublishHandleRequest | PublishSIWFSignupRequest | PublishKeysRequest> =
  RequestType & {
    providerId: string;
    referenceId: string;
  };

export type TxMonitorJob = TransactionData & {
  id: string;
  txHash: Hash;
  epoch: string;
  lastFinalizedBlockHash: BlockHash;
};

type TxWebhookRspBase = {
  transactionType: TransactionType;
  providerId: TransactionData['providerId'];
  referenceId: TransactionData['referenceId'];
  msaId: string;
  [key: string]: any; // for the properties in 'options'
};

export type PublishHandleOpts = { handle: string };
export type SIWFOpts = { handle: string; accountId: string; providerId: TransactionData['providerId'] };
export type PublishKeysOpts = { newPublicKey: string };
export type TxWebhookOpts = PublishHandleOpts | SIWFOpts | PublishKeysOpts;

export type PublishHandleWebhookRsp = TxWebhookRspBase & PublishHandleOpts;
export type SIWFWebhookRsp = TxWebhookRspBase & SIWFOpts;
export type PublishKeysWebhookRsp = TxWebhookRspBase & PublishKeysOpts;
export type TxWebhookRsp = PublishHandleWebhookRsp | SIWFWebhookRsp | PublishKeysWebhookRsp;
