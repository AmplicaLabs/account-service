import { Job } from 'bullmq';
import { TxMonitorJob, TxWebhookOpts, TxWebhookRsp } from '#lib/types/dtos/transaction.request.dto';

export function createWebhookRsp<TxWebhookRspType>(
  job: Job<TxMonitorJob, any, string>,
  msaId: string,
  options: TxWebhookOpts,
): TxWebhookRspType {
  return {
    transactionType: job.data.type,
    providerId: job.data.providerId,
    referenceId: job.data.referenceId,
    msaId,
    ...options,
  };
}
