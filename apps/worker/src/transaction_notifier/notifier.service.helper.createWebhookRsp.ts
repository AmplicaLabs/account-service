import { Job } from 'bullmq';
import { TxMonitorJob, TxWebhookOpts } from '#lib/types/dtos/transaction.request.dto';

export function createWebhookRsp(job: Job<TxMonitorJob, any, string>, msaId: string, options: TxWebhookOpts) {
  return {
    transactionType: job.data.type,
    providerId: job.data.providerId,
    referenceId: job.data.referenceId,
    msaId,
    ...options,
  };
}
