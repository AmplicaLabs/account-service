import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { Processor } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { MILLISECONDS_PER_SECOND } from 'time-constants';
import { IEventData, RegistryError } from '@polkadot/types/types';
import axios from 'axios';
import { BlockchainConstants } from '#lib/blockchain/blockchain-constants';
import { BlockchainService } from '#lib/blockchain/blockchain.service';
import { TransactionType } from '#lib/types/enums';
import { QueueConstants } from '#lib/utils/queues';
import { BaseConsumer } from '#worker/BaseConsumer';
import { TxMonitorJob, SECONDS_PER_BLOCK, TxWebhookRsp } from 'libs/common/src';
import { ConfigService } from '#lib/config/config.service';
import { createWebhookRsp } from '#worker/transaction_notifier/notifier.service.helper.createWebhookRsp';

@Injectable()
@Processor(QueueConstants.TRANSACTION_NOTIFY_QUEUE)
export class TxnNotifierService extends BaseConsumer {
  constructor(
    @InjectRedis() private cacheManager: Redis,
    private blockchainService: BlockchainService,
    private configService: ConfigService,
  ) {
    super();
  }

  /**
   * Processes a job for transaction notification.
   *
   * @param job - Search the finalized blocks for the transaction hash in TxMonitorJob.
   * @returns A promise that resolves to the result of the processing.
   * @throws If there is an error during the processing.
   */
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
        const message = `Tx ${job.data.txHash} not found in block list`;
        this.logger.error(message);
        throw new Error(message);
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
          let webhookResponse: Partial<TxWebhookRsp> = {};
          webhookResponse.referenceId = job.data.id;

          const jobType: TxMonitorJob['type'] = job.data.type;
          switch (jobType) {
            case TransactionType.CHANGE_HANDLE:
            case TransactionType.CREATE_HANDLE:
              if (!txResult.events) {
                this.logger.error('No Handle events found in tx result');
              } else {
                const handleTxnValues = this.blockchainService.handlePublishHandleTxResult(txResult.events);

                webhookResponse = createWebhookRsp(job, handleTxnValues.msaId, { handle: handleTxnValues.handle });

                this.logger.debug(handleTxnValues.debugMsg);
                this.logger.log(
                  `Handles: ${webhookResponse.transactionType} finalized handle ${webhookResponse.handle} for msaId ${webhookResponse.msaId}.`,
                );
              }
              break;
            case TransactionType.SIWF_SIGNUP:
              if (!txResult.events) {
                this.logger.error('No SIWF events found in tx result');
              } else {
                const siwfTxnValues = this.blockchainService.handleSIWFTxnResult(txResult.events);

                webhookResponse = createWebhookRsp(job, siwfTxnValues.msaId, {
                  accountId: siwfTxnValues.address,
                  handle: siwfTxnValues.handle,
                });

                this.logger.log(
                  `SIWF: ${siwfTxnValues.address} Signed up handle ${webhookResponse.handle} for msaId ${webhookResponse.msaId} delegated to provider ${siwfTxnValues.newProvider}.`,
                );
              }
              break;
            case TransactionType.ADD_KEY:
              if (!txResult.events) {
                this.logger.error('No ADD KEY events found in tx result');
              } else {
                const publicKeyValues = this.blockchainService.handlePublishKeyTxResult(txResult.events);

                webhookResponse = createWebhookRsp(job, publicKeyValues.msaId, {
                  newPublicKey: publicKeyValues.newPublicKey,
                });

                this.logger.debug(publicKeyValues.debugMsg);
                this.logger.log(
                  `Keys: Added the key ${webhookResponse.newPublicKey} for msaId ${webhookResponse.msaId}.`,
                );
              }
              break;
            default:
              this.logger.error(`Unknown transaction type on job.data: ${jobType}`);
              break;
          }

          let retries = 0;
          while (retries < this.configService.healthCheckMaxRetries) {
            try {
              this.logger.debug(`Sending transaction notification to webhook: ${webhook}`);
              this.logger.debug(`Transaction: ${JSON.stringify(webhookResponse)}`);
              // eslint-disable-next-line no-await-in-loop
              await axios.post(webhook, webhookResponse);
              this.logger.debug(`Transaction Notification sent to webhook: ${webhook}`);
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
