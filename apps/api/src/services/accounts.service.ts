import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RequestedSchema, SiwsOptions, validateSignin, validateSignup } from '@amplica-labs/siwf';
import { BlockchainService } from '#lib/blockchain/blockchain.service';
import { TransactionType } from '#lib/types/enums';
import { QueueConstants } from '#lib/utils/queues';
import { ConfigService } from '#lib/config/config.service';
import { EnqueueService } from '#lib/services/enqueue-request.service';
import { WalletLoginRequest, PublishSIWFSignupRequest } from '#lib/types/dtos/wallet.login.request.dto';
import { WalletLoginResponse } from '#lib/types/dtos/wallet.login.response.dto';
import { AccountResponse } from '#lib/types/dtos/accounts.response.dto';
import { WalletLoginConfigResponse } from '#lib/types/dtos/wallet.login.config.response.dto';
import { AnnouncementType } from '#lib/types/dsnp';

// eslint-disable-next-line no-shadow
export enum ChainType {
  Local,
  Testnet,
  Mainnet,
}

@Injectable()
export class AccountsService {
  private readonly logger: Logger;

  constructor(
    @InjectQueue(QueueConstants.TRANSACTION_PUBLISH_QUEUE)
    private transactionPublishQueue: Queue,
    private configService: ConfigService,
    private blockchainService: BlockchainService,
    private enqueueService: EnqueueService,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  private getChainType = (): ChainType => {
    const { frequencyUrl } = this.configService;
    if (frequencyUrl.toString().includes('rococo')) return ChainType.Testnet;
    if (
      frequencyUrl.toString().includes('localhost') ||
      frequencyUrl.toString().includes('127.0.0.1') ||
      frequencyUrl.toString().includes('::1')
    )
      return ChainType.Local;
    return ChainType.Mainnet;
  };

  // eslint-disable-next-line class-methods-use-this
  private TestnetSchemas = (type: AnnouncementType): number => {
    switch (type) {
      case AnnouncementType.Tombstone:
        return 1;
      case AnnouncementType.Broadcast:
        return 2;
      case AnnouncementType.Reply:
        return 3;
      case AnnouncementType.Reaction:
        return 4;
      case AnnouncementType.Profile:
        return 6;
      case AnnouncementType.Update:
        return 5;
      case AnnouncementType.PublicFollows:
        return 13;
      default:
    }
    throw new Error('Unknown Announcement Type');
  };

  // eslint-disable-next-line class-methods-use-this
  private MainnetSchemas = (type: AnnouncementType): number => {
    switch (type) {
      case AnnouncementType.Tombstone:
        return 1;
      case AnnouncementType.Broadcast:
        return 2;
      case AnnouncementType.Reply:
        return 3;
      case AnnouncementType.Reaction:
        return 4;
      case AnnouncementType.Profile:
        return 5;
      case AnnouncementType.Update:
        return 6;
      case AnnouncementType.PublicFollows:
        return 8;
      default:
    }
    throw new Error('Unknown Announcement Type');
  };

  // eslint-disable-next-line class-methods-use-this
  getSchemaId = (type: AnnouncementType): number => {
    if (this.getChainType() === ChainType.Testnet) {
      return this.TestnetSchemas(type);
    }
    return this.MainnetSchemas(type);
  };

  async getAccount(msaId: number): Promise<AccountResponse> {
    const isValidMsaId = await this.blockchainService.isValidMsaId(msaId);
    if (isValidMsaId) {
      const handle = await this.blockchainService.getHandleForMsa(msaId);
      return { msaId, handle };
    }
    throw new Error('Invalid msaId.');
  }

  async getSIWFConfig(): Promise<WalletLoginConfigResponse> {
    let response: WalletLoginConfigResponse;
    try {
      const { providerId, frequencyUrl } = this.configService;
      const proxyUrl = 'localhost';
      const addProviderSchemas: RequestedSchema[] = [
        {
          name: 'broadcast',
          id: this.getSchemaId(AnnouncementType.Broadcast),
        },
        {
          name: 'reaction',
          id: this.getSchemaId(AnnouncementType.Reaction),
        },
        {
          name: 'reply',
          id: this.getSchemaId(AnnouncementType.Reply),
        },
        {
          name: 'tombstone',
          id: this.getSchemaId(AnnouncementType.Tombstone),
        },
        {
          name: 'profile',
          id: this.getSchemaId(AnnouncementType.Profile),
        },
        {
          name: 'update',
          id: this.getSchemaId(AnnouncementType.Update),
        },
        {
          name: 'public-follows',
          id: this.getSchemaId(AnnouncementType.PublicFollows),
        },
      ];
      // Make sure they are sorted.
      addProviderSchemas.sort();

      response = {
        providerId: providerId.toString(),
        proxyUrl: proxyUrl.toString(),
        frequencyRpcUrl: frequencyUrl.toString(),
        schemas: addProviderSchemas,
      };
    } catch (e) {
      this.logger.error(`Error during SIWF config request: ${e}`);
      throw new Error('Failed to get SIWF config');
    }
    return response;
  }

  // eslint-disable-next-line class-methods-use-this
  async signInWithFrequency(request: WalletLoginRequest): Promise<WalletLoginResponse> {
    const api = await this.blockchainService.getApi();
    const { providerId } = this.configService;
    if (request.signUp) {
      try {
        const siwfPayload = await validateSignup(api, request.signUp, providerId.toString());
        // Pass all this data to the transaction publisher queue
        const referenceId: WalletLoginResponse = await this.enqueueService.enqueueRequest<PublishSIWFSignupRequest>({
          ...siwfPayload,
          type: TransactionType.SIWF_SIGNUP,
        });
        return referenceId;
      } catch (e: any) {
        this.logger.error(`Failed Signup validation ${e.toString()}`);
        throw new Error('Failed to sign up');
      }
    } else if (request.signIn) {
      try {
        const parsedSignin = await validateSignin(api, request.signIn, 'localhost');
        const response: WalletLoginResponse = {
          referenceId: '0',
          msaId: parsedSignin.msaId,
          publicKey: parsedSignin.publicKey,
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
