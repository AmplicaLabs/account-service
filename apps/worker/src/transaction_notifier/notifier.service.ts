import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { InjectQueue, Processor } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import { MILLISECONDS_PER_SECOND } from 'time-constants';
import { RegistryError } from '@polkadot/types/types';
import axios from 'axios';

import { ConfigService } from '../../../../libs/common/src/config/config.service';
import { QueueConstants, SECONDS_PER_BLOCK } from '../../../../libs/common/src';
import { BaseConsumer } from '../BaseConsumer';
import { BlockchainConstants } from '../../../../libs/common/src/blockchain/blockchain-constants';
import { BlockchainService } from '../../../../libs/common/src/blockchain/blockchain.service';
import { TransactionNotification, TxMonitorJob } from '../../../../libs/common/src/types/dtos/transaction.dto';
import { TransactionType } from '../../../../libs/common/src/types/enums';

@Injectable()
@Processor(QueueConstants.TRANSACTION_NOTIFY_QUEUE)
export class TxnNotifierService extends BaseConsumer {
  constructor(
    @InjectRedis() private cacheManager: Redis,
    @InjectQueue(QueueConstants.TRANSACTION_NOTIFY_QUEUE)
    private transactionNotifyQueue: Queue,
    private blockchainService: BlockchainService,
    private configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<TxMonitorJob, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
    try {
      const numberBlocksToParse = BlockchainConstants.NUMBER_BLOCKS_TO_CRAWL;
      const txCapacityEpoch = job.data.epoch;
      const previousKnownBlockNumber = (
        await this.blockchainService.getBlock(job.data.lastFinalizedBlockHash)
      ).block.header.number.toBigInt();
      const currentFinalizedBlockNumber = await this.blockchainService.getLatestFinalizedBlockNumber();
      const blockList: bigint[] = [];

      for (
        let i = previousKnownBlockNumber;
        i <= currentFinalizedBlockNumber && i < previousKnownBlockNumber + numberBlocksToParse;
        i += 1n
      ) {
        blockList.push(i);
      }
      const txResult = await this.blockchainService.crawlBlockListForTx(job.data.txHash, blockList, [
        { pallet: 'system', event: 'ExtrinsicSuccess' },
      ]);
      if (!txResult.found) {
        this.logger.error(`Tx ${job.data.txHash} not found in block list`);
        throw new Error(`Tx ${job.data.txHash} not found in block list`);
      } else {
        // Set current epoch capacity
        await this.setEpochCapacity(txCapacityEpoch, BigInt(txResult.capacityWithDrawn ?? 0n));
        if (txResult.error) {
          this.logger.debug(`Error found in tx result: ${JSON.stringify(txResult.error)}`);
          const errorReport = await this.handleMessagesFailure(txResult.error);
          if (errorReport.retry) {
            // TODO: Determine if errors are recoverable and if we need to retry the job
            // await this.retryRequestJob(job.data.referencePublishJob.referenceId);
          } else {
            throw new Error(`Job ${job.data.id} failed with error ${JSON.stringify(txResult.error)}`);
          }
        }

        if (txResult.success) {
          this.logger.verbose(`Successfully found ${job.data.txHash} found in block ${txResult.blockHash}`);
          const webhook = await this.getWebhook();

          // TODO: Set the appropriate payload data for the webhook callback
          switch (job.data.type) {
            case TransactionType.CHANGE_HANDLE:
              this.logger.debug(`Changed handle for ${job.data.providerId}.`);
              break;
            case TransactionType.CREATE_HANDLE:
              this.logger.debug(`Created handle for ${job.data.providerId}.`);
              break;
            case TransactionType.SIWF_SIGNUP:
              this.logger.debug(`Signed up for ${job.data.providerId}.`);
              break;
            default:
              // TODO: Property 'type' does not exist on type 'never'
              // Resolve this error to log the wrong type.
              this.logger.error(`Unknown transaction type on job.data: ${job.data}`);
              break;
          }

          const notification: TransactionNotification = {
            msaId: job.data.providerId,
            data: job.data,
          };

          let retries = 0;
          while (retries < this.configService.healthCheckMaxRetries) {
            try {
              this.logger.debug(`Sending transaction notification to webhook: ${webhook}`);
              this.logger.debug(`Transaction: ${JSON.stringify(notification)}`);
              // eslint-disable-next-line no-await-in-loop
              await axios.post(webhook, notification);
              this.logger.debug(`Notification sent to webhook: ${webhook}`);
              break;
            } catch (error) {
              this.logger.error(`Failed to send notification to webhook: ${webhook}`);
              this.logger.error(error);
              retries += 1;
            }
          }
        }
      }
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  // TODO: Determine if any errors are recoverable and if we need to retry the job
  //       The queue will automatically retry the job if it fails already.

  // private async retryRequestJob(requestReferenceId: string): Promise<void> {
  //   this.logger.debug(`Retrying graph change request job ${requestReferenceId}`);
  //   const requestJob: Job<ProviderGraphUpdateJob, any, string> | undefined =
  //     await this.changeRequestQueue.getJob(requestReferenceId);
  //   if (!requestJob) {
  //     this.logger.debug(`Job ${requestReferenceId} not found in queue`);
  //     return;
  //   }
  //   await this.changeRequestQueue.remove(requestReferenceId);
  //   await this.changeRequestQueue.add(
  //     `Retrying publish job - ${requestReferenceId}`,
  //     requestJob.data,
  //     {
  //       jobId: requestReferenceId,
  //     },
  //   );
  // }

  private async setEpochCapacity(epoch: string, capacityWithdrew: bigint): Promise<void> {
    const epochCapacityKey = `epochCapacity:${epoch}`;

    try {
      const savedCapacity = await this.cacheManager.get(epochCapacityKey);
      const epochCapacity = BigInt(savedCapacity ?? 0);
      const newEpochCapacity = epochCapacity + capacityWithdrew;

      const epochDurationBlocks = await this.blockchainService.getCurrentEpochLength();
      const epochDuration = epochDurationBlocks * SECONDS_PER_BLOCK * MILLISECONDS_PER_SECOND;
      await this.cacheManager.setex(epochCapacityKey, epochDuration, newEpochCapacity.toString());
    } catch (error) {
      this.logger.error(`Error setting epoch capacity: ${error}`);
    }
  }

  private async handleMessagesFailure(moduleError: RegistryError): Promise<{ pause: boolean; retry: boolean }> {
    try {
      // Handle the possible errors for create_sponsored_account_with_delegation and grant_delegation from the msa pallet
      this.logger.debug(`Handling module error: ${moduleError?.method}`);
      switch (moduleError.method) {
        case 'AddProviderSignatureVerificationFailed':
        case 'DuplicateProvider':
        case 'UnauthorizedProvider':
        case 'InvalidSelfProvider':
        case 'InvalidSignature':
        case 'NoKeyExists':
        case 'KeyAlreadyRegistered':
        case 'ProviderNotRegistered':
        case 'ProofNotYetValid':
        case 'ProofHasExpired':
        case 'SignatureAlreadySubmitted':
        case 'UnauthorizedDelegator':
          // TODO: Are any of these errors recoverable?
          return { pause: false, retry: false };
        default:
          this.logger.error(`Unknown module error ${moduleError}`);
          break;
      }
    } catch (error) {
      this.logger.error(`Error handling module error: ${error}`);
    }

    // unknown error, pause the queue
    return { pause: false, retry: false };
  }

  async getWebhookList(msaId: number): Promise<string[]> {
    const redisKey = `${QueueConstants.REDIS_WATCHER_PREFIX}:${msaId}`;
    const redisList = await this.cacheManager.lrange(redisKey, 0, -1);

    return redisList || [];
  }

  async getWebhook(): Promise<string> {
    return this.configService.providerBaseUrl.toString();
  }
}
