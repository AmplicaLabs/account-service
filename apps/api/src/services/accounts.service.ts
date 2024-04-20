import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Hash, createHash, randomUUID } from 'crypto';
import { validateSignin, validateSignup } from '@amplica-labs/siwf';
import { QueueConstants, TransactionData, TransactionType } from '../../../../libs/common/src';
import { BlockchainService } from '../../../../libs/common/src/blockchain/blockchain.service';
import type { AccountResponse } from '../../../../libs/common/src/types/dtos/accounts.dto';
import { ConfigService } from '../../../../libs/common/src/config/config.service';
import { PublishSIWFSignupRequest, WalletLoginRequest } from '../../../../libs/common/src/types/dtos/wallet.login.request.dto';
import { SIWFSignupRequest, WalletLoginResponse } from '../../../../libs/common/src/types/dtos/wallet.login.response.dto';

export type RequestAccount = { publicKey: string; msaId?: string };
@Injectable()
export class AccountsService {
  private readonly logger: Logger;

  // uuid auth token to Public Key
  private authTokenRegistry: Map<string, RequestAccount> = new Map();

  constructor(
    // @InjectRedis() private redis: Redis,
    @InjectQueue(QueueConstants.TRANSACTION_PUBLISH_QUEUE)
    private transactionPublishQueue: Queue,
    private configService: ConfigService,
    private blockchainService: BlockchainService,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Creates an authentication token for the given public key.
   * @param publicKey - The public key associated with the authentication token.
   * @returns A Promise that resolves to the generated authentication token.
   */
  private createAuthToken = async (publicKey: string): Promise<string> => {
    const uuid = randomUUID();
    this.authTokenRegistry.set(uuid, { publicKey });
    return uuid;
  };

  /**
   * Calculates the job ID based on the provided job object.
   * @param jobWithoutId - The job object without the ID.
   * @returns The calculated job ID.
   */
  // eslint-disable-next-line class-methods-use-this
  public calculateJobId(jobWithoutId): string {
    const stringVal = JSON.stringify(jobWithoutId);
    return createHash('sha1').update(stringVal).digest('base64url');
  }

  async enqueueRequest(request, type: TransactionType): Promise<string> {
    const providerId = this.configService.getProviderId();
    const data: TransactionData<PublishSIWFSignupRequest> = {
      ...request,
      type,
      providerId,
      referenceId: this.calculateJobId(request),
    };

    const job = await this.transactionPublishQueue.add(`Transaction Job - ${data.referenceId}`, data, {
      jobId: data.referenceId,
    });
    this.logger.debug(`enqueue job: ${job}`);
    return data.referenceId;
  }

  async getAccount(msaId: number): Promise<AccountResponse> {
    const isValidMsaId = await this.blockchainService.isValidMsaId(msaId);
    if (isValidMsaId) {
      const handle = await this.blockchainService.getHandleForMsa(msaId);
      return { msaId, handle };
    }
    throw new Error('Invalid msaId.');
  }

  // eslint-disable-next-line class-methods-use-this
  async signInWithFrequency(request: WalletLoginRequest): Promise<WalletLoginResponse> {
    const api = await this.blockchainService.getApi();
    const providerId = this.configService.getProviderId();
    let response: WalletLoginResponse;
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
}
