import '@frequency-chain/api-augment';

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BlockchainModule } from '#lib/blockchain/blockchain.module';
import { NonceService } from '#lib/services/nonce.service';
import { QueueConstants } from '#lib/utils/queues';
import { ConfigModule } from '#lib/config/config.module';
import { TransactionPublisherService } from './publisher.service';

@Module({
  imports: [
    BlockchainModule,
    ConfigModule,
    BullModule.registerQueue({
      name: QueueConstants.TRANSACTION_PUBLISH_QUEUE,
      defaultJobOptions: {
        removeOnComplete: 20,
        removeOnFail: false,
      },
    }),
  ],
  providers: [TransactionPublisherService, NonceService],
  exports: [TransactionPublisherService],
})
export class TransactionPublisherModule {}
