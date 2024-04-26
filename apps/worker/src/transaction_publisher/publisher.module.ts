/*
https://docs.nestjs.com/modules
*/
import '@frequency-chain/api-augment';

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BlockchainModule } from '../../../../libs/common/src/blockchain/blockchain.module';
import { ConfigModule } from '../../../../libs/common/src/config/config.module';
import { NonceService, QueueConstants } from '../../../../libs/common/src';
import { TransactionPublisherService } from './publisher.service';

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
        },
      },
      {
        name: QueueConstants.TRANSACTION_NOTIFY_QUEUE,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
    ),
  ],
  providers: [TransactionPublisherService, NonceService],
  exports: [TransactionPublisherService],
})
export class TransactionPublisherModule {}
