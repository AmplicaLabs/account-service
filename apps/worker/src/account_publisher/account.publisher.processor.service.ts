import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { InjectQueue, Processor } from '@nestjs/bullmq';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import { Call, Hash } from '@polkadot/types/interfaces';
import { KeyringPair } from '@polkadot/keyring/types';
import { SubmittableExtrinsic } from '@polkadot/api-base/types';
import { Codec, ISubmittableResult } from '@polkadot/types/types';
import { MILLISECONDS_PER_SECOND } from 'time-constants';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '../../../../libs/common/src/config/config.service';
import { QueueConstants, NonceService } from '../../../../libs/common/src';
import { BaseConsumer } from '../BaseConsumer';
import { BlockchainService } from '../../../../libs/common/src/blockchain/blockchain.service';
import { createKeys } from '../../../../libs/common/src/blockchain/create-keys';
import { Extrinsic } from '../../../../libs/common/src/blockchain/extrinsic';
import { ITxMonitorJob } from '../../../../libs/common/src/dtos/account.notifier.job';
import { AccountChangeType } from '../../../../libs/common/src/dtos/account.change.notification.dto';

export const SECONDS_PER_BLOCK = 12;
const CAPACITY_EPOCH_TIMEOUT_NAME = 'capacity_check';

/**
 * Service responsible for publishing account updates.
 */
@Injectable()
@Processor(QueueConstants.ACCOUNT_CHANGE_PUBLISH_QUEUE)
export class AccountUpdatePublisherService extends BaseConsumer implements OnApplicationShutdown {
  public async onApplicationBootstrap() {
    await this.checkCapacity();
  }

  public async onApplicationShutdown(signal?: string | undefined): Promise<void> {
    try {
      this.schedulerRegistry.deleteTimeout(CAPACITY_EPOCH_TIMEOUT_NAME);
    } catch (err) {
      // ignore
    }
  }

  constructor(
    @InjectRedis() private cacheManager: Redis,
    @InjectQueue(QueueConstants.ACCOUNT_CHANGE_PUBLISH_QUEUE)
    private accountChangePublishQueue: Queue,
    @InjectQueue(QueueConstants.ACCOUNT_CHANGE_NOTIFY_QUEUE)
    private accountChangeNotifyQueue: Queue,
    private configService: ConfigService,
    private blockchainService: BlockchainService,
    private nonceService: NonceService,
    private schedulerRegistry: SchedulerRegistry,
  ) {
    super();
  }

  /**
   * Processes a job for account update.
   * @param job - The job to process.
   * @returns A promise that resolves when the job is processed.
   */
  async process(job: Job<any, any, string>): Promise<any> {
    let accountTxnHash: Hash = {} as Hash;

    try {
      this.logger.log(`Processing job ${job.id} of type ${job.name}.... ${JSON.stringify(job)}`);
      const lastFinalizedBlockHash = await this.blockchainService.getLatestFinalizedBlockHash();
      const currentCapacityEpoch = await this.blockchainService.getCurrentCapacityEpoch();
      const providerKeys = createKeys(this.configService.getProviderAccountSeedPhrase());
      let tx: SubmittableExtrinsic<any>;
      switch (job.data.type) {
        case AccountChangeType.CREATE_HANDLE: {
          tx = await this.blockchainService.claimHandle(job.data.accountId, job.data.baseHandle, [
            job.data.providerId,
            job.data.payload,
          ]);
          accountTxnHash = await this.processSingleTxn(providerKeys, tx);
          this.logger.debug(`tx: ${tx}`);
          this.logger.debug(`successful job: ${JSON.stringify(job, null, 2)}`);
          break;
        }
        case AccountChangeType.CHANGE_HANDLE: {
          tx = await this.blockchainService.changeHandle(job.data.accountId, job.data.baseHandle, [
            job.data.providerId,
            job.data.payload,
          ]);
          accountTxnHash = await this.processSingleTxn(providerKeys, tx);
          this.logger.debug(`tx: ${tx}`);
          this.logger.debug(`successful job: ${JSON.stringify(job, null, 2)}`);
          break;
        }
        case AccountChangeType.SIWF_SIGNUP: {
          // eslint-disable-next-line prettier/prettier
          const txns = job.data.calls?.map((x) =>
            this.blockchainService.api.tx(x.encodedExtrinsic),
          );
          const callVec = this.blockchainService.createType('Vec<Call>', txns);
          this.logger.debug(`callVec[0]: ${callVec[0].toHuman()}`);
          this.logger.debug(`callVec[1]: ${callVec[1].toHuman()}`);
          accountTxnHash = await this.processBatchTxn(providerKeys, callVec);
          break;
        }
        default: {
          throw new Error(`Invalid job type: ${job.data.type}`);
        }
      }

      // Add a job to the account change notify queue
      // const txMonitorJob: ITxMonitorJob = {
      const txMonitorJob = {
        id: job.data.referenceId,
        txHash: accountTxnHash,
        epoch: currentCapacityEpoch.toString(),
        lastFinalizedBlockHash,
        referencePublishJob: job.data,
      };
      const blockDelay = SECONDS_PER_BLOCK * MILLISECONDS_PER_SECOND;

      this.logger.debug(`Adding job to transaction change notify queue: ${txMonitorJob.id}`);
      this.accountChangeNotifyQueue.add(`Transaction Change Notify Job - ${txMonitorJob.id}`, txMonitorJob, {
        delay: blockDelay,
      });
    } catch (error: any) {
      this.logger.error(error);
      throw error;
    } finally {
      await this.checkCapacity();
    }
  }

  /**
   * Processes a single transaction to the blockchain.
   *
   * @param providerKeys The key pair used for signing the transaction.
   * @param tx The transaction to be submitted.
   * @returns The hash of the submitted transaction.
   * @throws Error if the transaction hash is undefined or if there is an error processing the batch.
   */
  async processSingleTxn(
    providerKeys: KeyringPair,
    tx: SubmittableExtrinsic<'rxjs', ISubmittableResult>,
  ): Promise<Hash> {
    this.logger.debug(
      `Submitting tx of size ${tx.length}, nonce:${tx.nonce}, method: ${tx.method.section}.${tx.method.method}`,
    );
    try {
      const ext = this.blockchainService.createExtrinsic(
        { pallet: 'frequencyTxPayment', extrinsic: 'payWithCapacity' },
        { eventPallet: 'frequencyTxPayment', event: 'CapacityPaid' },
        providerKeys,
        tx,
      );
      const nonce = await this.nonceService.getNextNonce();
      this.logger.debug(`Capacity Wrapped Extrinsic: ${ext}, nonce:${nonce}`);
      const [txHash, _] = await ext.signAndSend(nonce);
      if (!txHash) {
        throw new Error('Tx hash is undefined');
      }
      this.logger.debug(`Tx hash: ${txHash}`);
      return txHash;
    } catch (error: any) {
      this.logger.error(`Error processing single transaction: ${error}`);
      throw error;
    }
  }

  async processBatchTxn(providerKeys: KeyringPair, callVec: Codec): Promise<Hash> {
    // this.logger.debug(
    //   `Submitting tx of size ${tx.length}, nonce:${tx.nonce}, method: ${tx.method.section}.${tx.method.method}`,
    // );
    this.logger.debug(`processBatchTxn: callVec: ${callVec.toHuman()}`);
    try {
      const ext = this.blockchainService.createExtrinsic(
        { pallet: 'frequencyTxPayment', extrinsic: 'payWithCapacityBatchAll' },
        { eventPallet: 'frequencyTxPayment', event: 'CapacityPaid' },
        providerKeys,
        callVec,
      );
      const nonce = await this.nonceService.getNextNonce();
      this.logger.debug(`Capacity Wrapped Extrinsic: ${ext}, nonce:${nonce}`);
      const [txHash, _] = await ext.signAndSend(nonce);
      if (!txHash) {
        throw new Error('Tx hash is undefined');
      }
      this.logger.debug(`Tx hash: ${txHash}`);
      return txHash;
    } catch (error: any) {
      this.logger.error(`Error processing batch transaction: ${error}`);
      throw error;
    }
  }

  /**
   * Checks the capacity of the account publisher and takes appropriate actions based on the capacity status.
   * If the capacity is exhausted, it pauses the account change publish queue and sets a timeout to check the capacity again.
   * If the capacity is refilled, it resumes the account change publish queue and clears the timeout.
   * If any jobs failed due to low balance/no capacity, it retries them.
   * If any error occurs during the capacity check, it logs the error.
   */
  private async checkCapacity(): Promise<void> {
    try {
      const capacityLimit = this.configService.getCapacityLimit();
      const capacityInfo = await this.blockchainService.capacityInfo(this.configService.getProviderId());
      const { remainingCapacity } = capacityInfo;
      const { currentEpoch } = capacityInfo;
      const epochCapacityKey = `epochCapacity:${currentEpoch}`;
      const epochUsedCapacity = BigInt((await this.cacheManager.get(epochCapacityKey)) ?? 0); // Fetch capacity used by the service
      let outOfCapacity = remainingCapacity <= 0n;

      if (!outOfCapacity) {
        this.logger.debug(`Capacity remaining: ${remainingCapacity}`);
        if (capacityLimit.type === 'percentage') {
          const capacityLimitPercentage = BigInt(capacityLimit.value);
          const capacityLimitThreshold = (capacityInfo.totalCapacityIssued * capacityLimitPercentage) / 100n;
          this.logger.debug(`Capacity limit threshold: ${capacityLimitThreshold}`);
          if (epochUsedCapacity >= capacityLimitThreshold) {
            outOfCapacity = true;
            this.logger.warn(`Capacity threshold reached: used ${epochUsedCapacity} of ${capacityLimitThreshold}`);
          }
        } else if (epochUsedCapacity >= capacityLimit.value) {
          outOfCapacity = true;
          this.logger.warn(`Capacity threshold reached: used ${epochUsedCapacity} of ${capacityLimit.value}`);
        }
      }

      if (outOfCapacity) {
        await this.accountChangePublishQueue.pause();
        const blocksRemaining = capacityInfo.nextEpochStart - capacityInfo.currentBlockNumber;
        const epochTimeout = blocksRemaining * SECONDS_PER_BLOCK * MILLISECONDS_PER_SECOND;
        this.logger.warn(
          `Capacity Exhausted: Pausing account change publish queue until next epoch: ${epochTimeout / 1000} seconds`,
        );
        try {
          // Check if a timeout with the same name already exists
          if (this.schedulerRegistry.doesExist('timeout', CAPACITY_EPOCH_TIMEOUT_NAME)) {
            // If it does, delete it
            this.schedulerRegistry.deleteTimeout(CAPACITY_EPOCH_TIMEOUT_NAME);
          }

          // Add the new timeout
          this.schedulerRegistry.addTimeout(
            CAPACITY_EPOCH_TIMEOUT_NAME,
            setTimeout(() => this.checkCapacity(), epochTimeout),
          );
        } catch (err) {
          // Handle any errors
          console.error(err);
        }
      } else {
        this.logger.verbose('Capacity Available: Resuming account change publish queue and clearing timeout');
        // Get the failed jobs and check if they failed due to capacity
        const failedJobs = await this.accountChangePublishQueue.getFailed();
        const capacityFailedJobs = failedJobs.filter((job) =>
          job.failedReason?.includes('1010: Invalid Transaction: Inability to pay some fees'),
        );
        // Retry the failed jobs
        await Promise.all(
          capacityFailedJobs.map(async (job) => {
            this.logger.debug(`Retrying job ${job.id}`);
            job.retry();
          }),
        );
        try {
          this.schedulerRegistry.deleteTimeout(CAPACITY_EPOCH_TIMEOUT_NAME);
        } catch (err) {
          // ignore
        }

        await this.accountChangePublishQueue.resume();
      }
    } catch (err) {
      this.logger.error('Caught error in checkCapacity', err);
    }
  }
}
