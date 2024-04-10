/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-undef */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiModule } from '../src/api.module';
import { KeyType } from '../../../libs/common/src';
import { WalletLoginRequestDTO } from '../../../libs/common/src/dtos/wallet.login.request.dto';

describe('Account Service E2E request verification!', () => {
  let app: INestApplication;
  let module: TestingModule;
  // eslint-disable-next-line no-promise-executor-return
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ApiModule],
    }).compile();
    console.log(`****************************module: ${module}`);

    app = module.createNestApplication();
    // const eventEmitter = app.get<EventEmitter2>(EventEmitter2);
    // eventEmitter.on('shutdown', async () => {
    //   await app.close();
    // });
    app.useGlobalPipes(new ValidationPipe());
    // app.enableShutdownHooks();
    await app.init();
  });

  it('(GET) /api/health', () =>
    request(app.getHttpServer()).get('/api/health').expect(200).expect({ status: 200, message: 'Service is healthy' }));

  // describe('(POST) /api/login', () => {
  //   it('Sign In With Frequency request should work', async () => {
  //     const siwfRequest: WalletLoginRequestDTO = {
  //       signIn: {
  //         siwsPayload: {
  //           message: '0x1234567890abcdef',
  //           signature: '0x1234567890abcdef',
  //         },
  //         error: {
  //           message: 'Error message',
  //         },
  //       },
  //       signUp: {
  //         extrinsics: [
  //           {
  //             pallet: 'msa',
  //             extrinsicName: 'createSponsoredAccountWithDelegation',
  //             encodedExtrinsic:
  //               '0xed01043c01b01b4dcafc8a8e73bff98e7558249f53cd0e0e64fa6b8f0159f0913d4874d9360176644186458bad3b00bbd0ac21e6c9bd5a8bed9ced7a772d11a9aac025b47f6559468808e272696f596a02af230951861027c0dc30f7163ecf316838a0723483010000000000000014000000000000000000004d000000',
  //           },
  //           {
  //             pallet: 'handles',
  //             extrinsicName: 'claimHandle',
  //             encodedExtrinsic:
  //               '0xb901044200b01b4dcafc8a8e73bff98e7558249f53cd0e0e64fa6b8f0159f0913d4874d93601225508ae2da9804c60660a150277eb32b2a0f6b9c8f6e07dd6cad799cb31ae1dfb43896f488e9c0b7ec8b530d930b3f9b690683f2765d5def3fee3fc6540d58714656e6464794d000000',
  //           },
  //         ],
  //       },
  //     };

  //     return request(app.getHttpServer())
  //       .post(`/api/login`)
  //       .send(siwfRequest)
  //       .expect(201)
  //       .expect((res) => expect(res.text).toContain('referenceId'));
  //   });
  // });

  afterAll(async () => {
    // await app.close();
  });
});
