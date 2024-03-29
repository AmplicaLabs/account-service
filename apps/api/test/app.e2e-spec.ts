/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-undef */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiModule } from '../src/api.module';
import { KeyType } from '../../../libs/common/src';

describe('Account Service E2E request verification!', () => {
  let app: INestApplication;
  let module: TestingModule;
  // eslint-disable-next-line no-promise-executor-return
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ApiModule],
    }).compile();

    app = module.createNestApplication();
    const eventEmitter = app.get<EventEmitter2>(EventEmitter2);
    eventEmitter.on('shutdown', async () => {
      await app.close();
    });
    app.useGlobalPipes(new ValidationPipe());
    app.enableShutdownHooks();
    await app.init();
  });

  it('(GET) /api/health', () =>
    request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 200, message: 'Service is healthy' }));

  //   describe('(POST) /api/update-graph', () => {
  //     it('Valid public graph update request should work', async () => {
  //       const validGraphChangeRequest: ProviderGraphDto = {
  //         dsnpId: '2',
  //         connections: {
  //           data: [
  //             {
  //               dsnpId: '4',
  //               privacyType: PrivacyType.Public,
  //               direction: Direction.ConnectionTo,
  //               connectionType: ConnectionType.Follow,
  //             } as ConnectionDto,
  //           ],
  //         },
  //       };

  //       return request(app.getHttpServer())
  //         .post(`/api/update-graph`)
  //         .send(validGraphChangeRequest)
  //         .expect(201)
  //         .expect((res) => expect(res.text).toContain('referenceId'));
  //     });
  //   });

  afterEach(async () => {
    await app.close();
  });
});
