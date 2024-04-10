import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash, randomUUID } from 'crypto';
import { MessageSourceId } from '@frequency-chain/api-augment/interfaces';
import { validateSignin, validateSignup } from '@amplica-labs/siwf';

import { NonceService, QueueConstants } from '../../../../libs/common/src';
import { ConfigService } from '../../../../libs/common/src/config/config.service';
import { BlockchainService } from '../../../../libs/common/src/blockchain/blockchain.service';
import { WalletLoginResponseDTO } from '../../../../libs/common/src/dtos/wallet.login.response.dto';
import { WalletLoginRequestDTO } from '../../../../libs/common/src/dtos/wallet.login.request.dto';
import { createKeys } from '../../../../libs/common/src/blockchain/create-keys';

export type RequestAccount = { publicKey: string; msaId?: string };
// uuid auth token to Public Key
const authTokenRegistry: Map<string, RequestAccount> = new Map();

@Injectable()
export class ApiService implements OnApplicationShutdown {
  private readonly logger: Logger;

  constructor(
    @InjectRedis() private redis: Redis,
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
    // REMOVE: ???
    // const api = await this.blockchainService.getApi();

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
    if (request.signUp) {
      try {
        // const siwf = await import('@amplica-labs/siwf');
        // console.log('siwf', siwf);

        const { calls, publicKey } = await validateSignup(api, request.signUp, providerId);
        const txns = calls?.map((x) => api.tx(x.encodedExtrinsic));
        const callVec = api.createType('Vec<Call>', txns);
        const nonce = await this.nonceService.getNextNonce();
        const providerKeys = createKeys(this.configService.getProviderAccountSeedPhrase());
        api.tx.frequencyTxPayment
          .payWithCapacityBatchAll(callVec)
          .signAndSend(providerKeys, { nonce }, ({ status, dispatchError }) => {
            if (dispatchError) {
              this.logger.error(`Error in Signup: ${dispatchError.toHuman()}`);
            } else if (status.isInBlock || status.isFinalized) {
              console.log('Account signup processed', status.toHuman());
            }
          });
        const response: WalletLoginResponseDTO = {
          accessToken: await this.createAuthToken(publicKey),
          expires: Date.now() + 60 * 60 * 24,
          msaId: '55',
          handle: 'TestHandle',
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
        const expires = Date.now() + 60 * 60 * 24;
      } catch (e) {
        this.logger.error(`Error during signin: ${e}`);
        throw new Error('Failed to sign in');
      }
    }

    const response: WalletLoginResponseDTO = {
      accessToken: 'accessToken',
      expires: 3600,
      msaId: '55',
      handle: 'TestHandle',
    };
    return response;
  }

  // async enqueueRequest(request: ProviderGraphDto): Promise<AccountChangeRepsonseDto> {
  //   const providerId = this.configService.getProviderId();
  //   const data: ProviderGraphUpdateJob = {
  //     msaId: request.msaId,
  //     providerId,
  //     connections: request.connections.data,
  //     graphKeyPairs: request.graphKeyPairs,
  //     referenceId: this.calculateJobId(request),
  //     updateConnection: this.configService.getReconnectionServiceRequired(),
  //   };
  //   const jobOld = await this.accountChangeRequestQueue.getJob(data.referenceId);
  //   if (jobOld && (await jobOld.isCompleted())) {
  //     await jobOld.remove();
  //   }
  //   const job = await this.accountChangeRequestQueue.add(`Request Job - ${data.referenceId}`, data, { jobId: data.referenceId });
  //   this.logger.debug(job);
  //   return {
  //     referenceId: data.referenceId,
  //   };
  // }

  // async watchGraphs(watchGraphsDto: WatchGraphsDto): Promise<void> {
  //   watchGraphsDto.msaIds.forEach(async (msaId) => {
  //     const redisKey = `${QueueConstants.REDIS_WATCHER_PREFIX}:${msaId}`;
  //     const redisValue = watchGraphsDto.webhookEndpoint;
  //     // eslint-disable-next-line no-await-in-loop
  //     await this.redis.rpush(redisKey, redisValue);
  //   });
  // }

  // async getGraphs(queryParams: GraphsQueryParamsDto): Promise<UserGraphDto[]> {
  //   const { msaIds, privacyType } = queryParams;
  //   const graphKeyPairs = queryParams.graphKeyPairs || [];
  //   const graphs: UserGraphDto[] = [];
  //   // eslint-disable-next-line no-restricted-syntax
  //   for (const msaId of msaIds) {
  //     const dsnpUserId: MessageSourceId = this.blockchainService.api.registry.createType('MessageSourceId', msaId);
  //     // eslint-disable-next-line no-await-in-loop
  //     const graphEdges = await this.asyncDebouncerService.getGraphForMsaId(dsnpUserId, privacyType, graphKeyPairs);
  //     graphs.push({
  //       msaId,
  //       dsnpGraphEdges: graphEdges,
  //     });
  //   }
  //   return graphs;
  // }

  // eslint-disable-next-line class-methods-use-this
  // private calculateJobId(jobWithoutId: ProviderGraphDto): string {
  //   const stringVal = JSON.stringify(jobWithoutId);
  //   return createHash('sha1').update(stringVal).digest('base64url');
  // }
}
