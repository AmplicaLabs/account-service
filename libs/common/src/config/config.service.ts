import { ICapacityLimit } from '#lib/interfaces/capacity-limit.interface';
import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

export interface ConfigEnvironmentVariables {
  REDIS_URL: URL;
  FREQUENCY_URL: URL;
  FREQUENCY_HTTP_URL: URL;
  API_PORT: number;
  BLOCKCHAIN_SCAN_INTERVAL_SECONDS: number;
  TRUST_UNFINALIZED_BLOCKS: boolean;
  PROVIDER_ACCOUNT_SEED_PHRASE: string;
  PROVIDER_ID: string;
  SIWF_URL: string;
  SIWF_DOMAIN: string;
  PROVIDER_BASE_URL: string;
  PROVIDER_ACCESS_TOKEN: string;
  WEBHOOK_FAILURE_THRESHOLD: number;
  HEALTH_CHECK_SUCCESS_THRESHOLD: number;
  WEBHOOK_RETRY_INTERVAL_SECONDS: number;
  HEALTH_CHECK_MAX_RETRY_INTERVAL_SECONDS: number;
  HEALTH_CHECK_MAX_RETRIES: number;
  CAPACITY_LIMIT: string;
}

/// Config service to get global app and provider-specific config values.
@Injectable()
export class ConfigService {
  private capacityLimitObj: ICapacityLimit;

  constructor(private nestConfigService: NestConfigService<ConfigEnvironmentVariables>) {
    this.capacityLimitObj = JSON.parse(this.nestConfigService.get<string>('CAPACITY_LIMIT')!);
  }

  public get blockchainScanIntervalSeconds(): number {
    return this.nestConfigService.get<number>('BLOCKCHAIN_SCAN_INTERVAL_SECONDS') ?? 12;
  }

  public get trustUnfinalizedBlocks(): boolean {
    return this.nestConfigService.get<boolean>('TRUST_UNFINALIZED_BLOCKS') ?? false;
  }

  public get providerBaseUrl(): URL {
    return this.nestConfigService.get<URL>('PROVIDER_BASE_URL')!;
  }

  public get providerApiToken(): string | undefined {
    return this.nestConfigService.get<string>('PROVIDER_ACCESS_TOKEN');
  }

  public get providerId(): string {
    return this.nestConfigService.get<string>('PROVIDER_ID')!;
  }

  public get siwfUrl(): string {
    return this.nestConfigService.get<string>('SIWF_URL')!;
  }

  public get siwfDomain(): string {
    return this.nestConfigService.get<string>('SIWF_DOMAIN')!;
  }

  public get apiPort(): number {
    return this.nestConfigService.get<number>('API_PORT')!;
  }

  public get providerAccountSeedPhrase(): string {
    return this.nestConfigService.get<string>('PROVIDER_ACCOUNT_SEED_PHRASE')!;
  }

  public get redisUrl(): URL {
    return this.nestConfigService.get('REDIS_URL')!;
  }

  public get frequencyUrl(): URL {
    return this.nestConfigService.get('FREQUENCY_URL')!;
  }

  public get frequencyHttpUrl(): URL {
    return this.nestConfigService.get('FREQUENCY_HTTP_URL')!;
  }

  public get healthCheckMaxRetries(): number {
    return this.nestConfigService.get<number>('HEALTH_CHECK_MAX_RETRIES')!;
  }

  public get healthCheckMaxRetryIntervalSeconds(): number {
    return this.nestConfigService.get<number>('HEALTH_CHECK_MAX_RETRY_INTERVAL_SECONDS')!;
  }

  public get healthCheckSuccessThreshold(): number {
    return this.nestConfigService.get<number>('HEALTH_CHECK_SUCCESS_THRESHOLD')!;
  }

  public get webhookFailureThreshold(): number {
    return this.nestConfigService.get<number>('WEBHOOK_FAILURE_THRESHOLD')!;
  }

  public get webhookRetryIntervalSeconds(): number {
    return this.nestConfigService.get('WEBHOOK_RETRY_INTERVAL_SECONDS')!;
  }

  public get capacityLimit(): ICapacityLimit {
    return this.capacityLimitObj;
  }
}
