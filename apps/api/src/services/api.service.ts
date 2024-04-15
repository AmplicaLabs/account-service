import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Hash, createHash, randomUUID } from 'crypto';
import { MessageSourceId } from '@frequency-chain/api-augment/interfaces';
import { validateSignin, validateSignup } from '@amplica-labs/siwf';

import { NonceService, QueueConstants, TransactionType } from '../../../../libs/common/src';
import { ConfigService } from '../../../../libs/common/src/config/config.service';
import { BlockchainService } from '../../../../libs/common/src/blockchain/blockchain.service';
import { WalletLoginResponseDTO } from '../../../../libs/common/src/types/dtos/wallet.login.response.dto';
import { WalletLoginRequestDTO } from '../../../../libs/common/src/types/dtos/wallet.login.request.dto';
import { createKeys } from '../../../../libs/common/src/blockchain/create-keys';
import { AccountChangeType } from '../../../../libs/common/src/types/dtos/account.change.notification.dto';

export type RequestAccount = { publicKey: string; msaId?: string };
// uuid auth token to Public Key
const authTokenRegistry: Map<string, RequestAccount> = new Map();

@Injectable()
export class ApiService implements OnApplicationShutdown {
  private readonly logger: Logger;

  constructor(
    @InjectRedis() private redis: Redis,
    @InjectQueue(QueueConstants.TRANSACTION_PUBLISH_QUEUE)
    private transactionPublishQueue: Queue,
    private configService: ConfigService,
    private blockchainService: BlockchainService,
    private nonceService: NonceService,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  onApplicationShutdown(signal?: string | undefined) {
    try {
      this.redis.del(QueueConstants.REDIS_WATCHER_PREFIX);
      this.redis.del(QueueConstants.DEBOUNCER_CACHE_KEY);
      this.redis.del(QueueConstants.LAST_PROCESSED_DSNP_ID_KEY);
      this.logger.log('Cleanup on shutdown completed.');
    } catch (e) {
      this.logger.error(`Error during cleanup on shutdown: ${e}`);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  createAuthToken = async (publicKey: string): Promise<string> => {
    const uuid = randomUUID();
    authTokenRegistry.set(uuid, { publicKey });
    return uuid;
  };

  // eslint-disable-next-line class-methods-use-this
  async createAccount(): Promise<string> {
    return 'Account created successfully';
  }

  // eslint-disable-next-line class-methods-use-this
  async signInWithFrequency(request: WalletLoginRequestDTO): Promise<WalletLoginResponseDTO> {
    const api = await this.blockchainService.getApi();
    const providerId = this.configService.getProviderId();
    let response: WalletLoginResponseDTO;
    if (request.signUp) {
      try {
        const payload = await validateSignup(api, request.signUp, providerId.toString());
        // Pass all this data to the transaction publisher queue
        const referenceId = await this.enqueueRequest(payload, TransactionType.SIWF_SIGNUP);

        response = {
          accessToken: await this.createAuthToken(payload.publicKey),
          expires: Date.now() + 60 * 60 * 24,
          referenceId: referenceId.toString(),
        };
        return response;
      } catch (e: any) {
        this.logger.error(`Failed Signup validation ${e.toString()}`);
        throw new Error('Failed to sign up');
      }
    } else if (request.signIn) {
      try {
        const parsedSignin = await validateSignin(api, request.signIn, 'localhost');
        const accessToken = await this.createAuthToken(parsedSignin.publicKey);
        // TODO: expiration should be configurable
        const expires = Date.now() + 60 * 60 * 24;
        response = {
          accessToken,
          expires,
          msaId: parsedSignin.msaId,
        };
        return response;
      } catch (e) {
        this.logger.error(`Error during SIWF signin request: ${e}`);
        const { cause } = e as any;
        this.logger.error(`cause: ${cause}`);
        throw new Error('Failed to Sign-In With Frequency');
      }
    }
    throw new Error('Invalid Sign-In With Frequency Request');
  }

  async enqueueRequest(request, type: TransactionType): Promise<Hash> {
    const providerId = this.configService.getProviderId();
    const data = {
      ...request,
      type,
      providerId,
      referenceId: this.calculateJobId(request),
    };

    const job = await this.transactionPublishQueue.add(`Transaction Job - ${data.referenceId}`, data, {
      jobId: data.referenceId,
    });
    this.logger.debug(`job: ${job}`);
    return data.referenceId;
  }

  // async watchGraphs(watchGraphsDto: WatchGraphsDto): Promise<void> {
  //   watchGraphsDto.msaIds.forEach(async (msaId) => {
  //     const redisKey = `${QueueConstants.REDIS_WATCHER_PREFIX}:${msaId}`;
  //     const redisValue = watchGraphsDto.webhookEndpoint;
  //     // eslint-disable-next-line no-await-in-loop
  //     await this.redis.rpush(redisKey, redisValue);
  //   });
  // }

  // eslint-disable-next-line class-methods-use-this
  private calculateJobId(jobWithoutId): string {
    const stringVal = JSON.stringify(jobWithoutId);
    return createHash('sha1').update(stringVal).digest('base64url');
  }
}
