/*
https://docs.nestjs.com/modules
*/

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { ConfigModule } from '../../../../libs/common/src/config/config.module';
import { ConfigService } from '../../../../libs/common/src/config/config.service';
import { QueueConstants } from '../../../../libs/common/src';
import { TxnNotifierService } from './notifier.service';
import { BlockchainModule } from '../../../../libs/common/src/blockchain/blockchain.module';
import { BlockchainService } from '../../../../libs/common/src/blockchain/blockchain.service';
import { EnqueueService } from '../../../../libs/common/src/services/enqueue-request.service';

@Module({
  imports: [
    BlockchainModule,
    ConfigModule,
    BullModule.registerQueue(
      {
        name: QueueConstants.TRANSACTION_PUBLISH_QUEUE,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
        },
      },
      {
        name: QueueConstants.TRANSACTION_NOTIFY_QUEUE,
        defaultJobOptions: {
          removeOnComplete: 20,
          removeOnFail: false,
          attempts: 3,
        },
      },
    ),
  ],
  providers: [TxnNotifierService, BlockchainService, EnqueueService, ConfigService],
  exports: [TxnNotifierService, BlockchainService, EnqueueService, ConfigService],
})
export class TxnNotifierModule {}
