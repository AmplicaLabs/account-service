import '@frequency-chain/api-augment';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { DEFAULT_REDIS_NAMESPACE, RedisModule, getRedisToken } from '@liaoliaots/nestjs-redis';
import { Redis } from 'ioredis';
import { BlockchainModule } from '../../../libs/common/src/blockchain/blockchain.module';
import { ConfigModule } from '../../../libs/common/src/config/config.module';
import { ConfigService } from '../../../libs/common/src/config/config.service';
import { TransactionPublisherModule } from './transaction_publisher/publisher.module';
import { TransactionPublisherService } from './transaction_publisher/publisher.service';
import {
  ProviderWebhookService,
  NonceService,
  QueueConstants,
  redisEventsToEventEmitter,
} from '../../../libs/common/src';
import { TxnNotifierService } from './transaction_notifier/notifier.service';
import { TxnNotifierModule } from './transaction_notifier/notifier.module';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot({
      // Use this instance throughout the application
      global: true,
      // set this to `true` to use wildcards
      wildcard: false,
      // the delimiter used to segment namespaces
      delimiter: '.',
      // set this to `true` if you want to emit the newListener event
      newListener: false,
      // set this to `true` if you want to emit the removeListener event
      removeListener: false,
      // the maximum amount of listeners that can be assigned to an event
      maxListeners: 20,
      // show event name in memory leak message when more than maximum amount of listeners is assigned
      verboseMemoryLeak: true,
      // disable throwing uncaughtException if an error event is emitted and it has no listeners
      ignoreErrors: false,
    }),
    RedisModule.forRootAsync(
      {
        imports: [ConfigModule, EventEmitterModule],
        useFactory: (configService: ConfigService, eventEmitter: EventEmitter2) => ({
          config: [
            {
              url: configService.redisUrl.toString(),
              maxRetriesPerRequest: null,
              onClientCreated(client) {
                redisEventsToEventEmitter(client, eventEmitter);
              },
              readyLog: false,
              errorLog: false,
            },
          ],
        }),
        inject: [ConfigService, EventEmitter2],
      },
      true, // isGlobal
    ),
    BullModule.forRootAsync({
      useFactory: (redis: Redis) => ({
        enableReadyCheck: true,
        connection: redis,
        sharedConnection: true,
      }),
      inject: [getRedisToken(DEFAULT_REDIS_NAMESPACE)],
    }),
    BullModule.registerQueue(
      {
        name: QueueConstants.TRANSACTION_PUBLISH_QUEUE,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 1,
        },
      },
      {
        name: QueueConstants.TRANSACTION_NOTIFY_QUEUE,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
        },
      },
    ),
    ScheduleModule.forRoot(),
    BlockchainModule,
    TransactionPublisherModule,
    TxnNotifierModule,
  ],
  providers: [ConfigService, TransactionPublisherService, TxnNotifierService, ProviderWebhookService, NonceService],
  exports: [],
})
export class WorkerModule {}
