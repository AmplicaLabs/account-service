/* eslint-disable no-underscore-dangle */
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { options } from '@frequency-chain/api-augment';
import { ApiPromise, ApiRx, HttpProvider, WsProvider } from '@polkadot/api';
import { firstValueFrom } from 'rxjs';
import { KeyringPair } from '@polkadot/keyring/types';
import { BlockHash, BlockNumber, DispatchError, EventRecord, Hash, SignedBlock } from '@polkadot/types/interfaces';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { AnyNumber, ISubmittableResult, RegistryError } from '@polkadot/types/types';
import { u32, Option, u128, Bytes, Vec } from '@polkadot/types';
import {
  CommonPrimitivesHandlesClaimHandlePayload,
  CommonPrimitivesMsaDelegation,
  FrameSystemEventRecord,
  PalletCapacityCapacityDetails,
  PalletCapacityEpochInfo,
  PalletSchemasSchemaInfo,
} from '@polkadot/types/lookup';
import { HandleResponse, KeyInfoResponse } from '@frequency-chain/api-augment/interfaces';
import { ConfigService } from '#lib/config/config.service';
import { TransactionType } from '#lib/types/enums';
import { HexString } from '@polkadot/util/types';
import { decodeAddress } from '@polkadot/util-crypto';
import { KeysRequest } from '#lib/types/dtos/keys.request.dto';
import { PublishHandleRequest } from '#lib/types/dtos/handles.request.dto';
import { TransactionData } from '#lib/types/dtos/transaction.request.dto';
import { Extrinsic } from './extrinsic';

export type Sr25519Signature = { Sr25519: HexString };
interface SIWFTxnValues {
  msaId: string;
  address: string;
  handle: string;
  newProvider: string;
}

interface HandleTxnValues {
  msaId: string;
  handle: string;
  debugMsg: string;
}

interface PublicKeyValues {
  msaId: string;
  newPublicKey: string;
  debugMsg: string;
}

@Injectable()
export class BlockchainService implements OnApplicationBootstrap, OnApplicationShutdown {
  public api: ApiRx;

  public apiPromise: ApiPromise;

  private configService: ConfigService;

  private logger: Logger;

  public async onApplicationBootstrap() {
    const providerUrl = this.configService.frequencyUrl!;
    let provider: WsProvider | HttpProvider;
    if (/^ws/.test(providerUrl.toString())) {
      provider = new WsProvider(providerUrl.toString());
    } else if (/^http/.test(providerUrl.toString())) {
      provider = new HttpProvider(providerUrl.toString());
    } else {
      this.logger.error(`Unrecognized chain URL type: ${providerUrl.toString()}`);
      throw new Error('Unrecognized chain URL type');
    }
    this.api = await firstValueFrom(ApiRx.create({ provider, ...options }));
    this.apiPromise = await ApiPromise.create({ provider, ...options });
    await Promise.all([firstValueFrom(this.api.isReady), this.apiPromise.isReady]);
    this.logger.log('Blockchain API ready.');
  }

  public async isReady(): Promise<boolean> {
    await this.apiPromise.isReady;
    return true;
  }

  public async getApi(): Promise<ApiPromise> {
    await this.apiPromise.isReady;
    return this.apiPromise;
  }

  public async onApplicationShutdown(signal?: string | undefined) {
    const promises: Promise<any>[] = [];
    if (this.api) {
      promises.push(this.api.disconnect());
    }

    if (this.apiPromise) {
      promises.push(this.apiPromise.disconnect());
    }
    await Promise.all(promises);
  }

  constructor(configService: ConfigService) {
    this.configService = configService;
    this.logger = new Logger(this.constructor.name);
  }

  public getBlockHash(block: BlockNumber | AnyNumber): Promise<BlockHash> {
    return firstValueFrom(this.api.rpc.chain.getBlockHash(block));
  }

  public getBlock(block: BlockHash): Promise<SignedBlock> {
    return firstValueFrom(this.api.rpc.chain.getBlock(block));
  }

  public async getLatestFinalizedBlockHash(): Promise<BlockHash> {
    return (await this.apiPromise.rpc.chain.getFinalizedHead()) as BlockHash;
  }

  public async getLatestFinalizedBlockNumber(): Promise<bigint> {
    return (await this.apiPromise.rpc.chain.getBlock()).block.header.number.toBigInt();
  }

  public async getBlockNumberForHash(hash: string): Promise<number | undefined> {
    const block = await this.apiPromise.rpc.chain.getBlock(hash);
    if (block) {
      return block.block.header.number.toNumber();
    }

    this.logger.error(`No block found corresponding to hash ${hash}`);
    return undefined;
  }

  public createType(type: string, ...args: (any | undefined)[]) {
    return this.api.registry.createType(type, ...args);
  }

  public createExtrinsicCall(
    { pallet, extrinsic }: { pallet: string; extrinsic: string },
    ...args: (any | undefined)[]
  ): SubmittableExtrinsic<'rxjs', ISubmittableResult> {
    return this.api.tx[pallet][extrinsic](...args);
  }

  public createExtrinsic(
    { pallet, extrinsic }: { pallet: string; extrinsic: string },
    { eventPallet, event }: { eventPallet?: string; event?: string },
    keys: KeyringPair,
    ...args: (any | undefined)[]
  ): Extrinsic {
    const targetEvent = eventPallet && event ? this.api.events[eventPallet][event] : undefined;
    return new Extrinsic(this.api, this.api.tx[pallet][extrinsic](...args), keys, targetEvent);
  }

  public rpc(pallet: string, rpc: string, ...args: (any | undefined)[]): Promise<any> {
    return this.apiPromise.rpc[pallet][rpc](...args);
  }

  public query(pallet: string, extrinsic: string, ...args: (any | undefined)[]): Promise<any> {
    return args ? this.apiPromise.query[pallet][extrinsic](...args) : this.apiPromise.query[pallet][extrinsic]();
  }

  public async queryAt(
    blockHash: BlockHash,
    pallet: string,
    extrinsic: string,
    ...args: (any | undefined)[]
  ): Promise<any> {
    const newApi = await this.apiPromise.at(blockHash);
    return newApi.query[pallet][extrinsic](...args);
  }

  public async getNonce(account: Uint8Array): Promise<number> {
    return this.rpc('system', 'accountNextIndex', account);
  }

  public async getSchema(schemaId: number): Promise<PalletSchemasSchemaInfo> {
    const schema: PalletSchemasSchemaInfo = await this.query('schemas', 'schemas', schemaId);
    return schema;
  }

  public async getMsaIdMax(): Promise<number> {
    const count = await this.query('msa', 'currentMsaIdentifierMaximum');
    // eslint-disable-next-line radix
    return parseInt(count);
  }

  public async isValidMsaId(msaId: number): Promise<boolean> {
    const msaIdMax = await this.getMsaIdMax();
    return msaId > 0 && msaId < msaIdMax;
  }

  public async getKeysByMsa(msaId: number): Promise<KeyInfoResponse> {
    const keyInfoResponse = this.api.rpc.msa.getKeysByMsaId(msaId);
    return (await firstValueFrom(keyInfoResponse)).unwrap();
  }

  public async addPublicKeyToMsa(keysRequest: KeysRequest): Promise<SubmittableExtrinsic<any>> {
    const { msaOwnerAddress, msaOwnerSignature, newKeyOwnerSignature, payload } = keysRequest;
    const msaIdU64 = this.api.createType('u64', payload.msaId);

    const txPayload = {
      ...payload,
      newPublicKey: decodeAddress(payload.newPublicKey),
      msaId: msaIdU64,
    };

    const addKeyResponse = this.api.tx.msa.addPublicKeyToMsa(
      msaOwnerAddress,
      { Sr25519: msaOwnerSignature },
      { Sr25519: newKeyOwnerSignature },
      txPayload,
    );
    return addKeyResponse;
  }

  public async publishHandle(jobData: TransactionData<PublishHandleRequest>) {
    const handleVec = new Bytes(this.api.registry, jobData.payload.baseHandle);
    const claimHandlePayload: CommonPrimitivesHandlesClaimHandlePayload = this.api.registry.createType(
      'CommonPrimitivesHandlesClaimHandlePayload',
      {
        baseHandle: handleVec,
        expiration: jobData.payload.expiration,
      },
    );

    this.logger.debug(`claimHandlePayload: ${claimHandlePayload}`);
    this.logger.debug(`accountId: ${jobData.accountId}`);

    const claimHandleProof: Sr25519Signature = { Sr25519: jobData.proof };
    this.logger.debug(`claimHandleProof: ${JSON.stringify(claimHandleProof)}`);

    switch (jobData.type) {
      case TransactionType.CREATE_HANDLE:
        return this.api.tx.handles.claimHandle(jobData.accountId, claimHandleProof, claimHandlePayload);
      case TransactionType.CHANGE_HANDLE:
        return this.api.tx.handles.changeHandle(jobData.accountId, claimHandleProof, claimHandlePayload);
      default:
        throw new Error(`Unrecognized transaction type: ${(jobData as any).type}`);
    }
  }

  public async getHandleForMsa(msaId: number): Promise<HandleResponse | null> {
    const handleResponse = await this.rpc('handles', 'getHandleForMsa', msaId);
    if (handleResponse.isSome) return handleResponse.unwrap();
    return null;
  }

  public async getCommonPrimitivesMsaDelegation(
    msaId: number,
    providerId: number,
  ): Promise<CommonPrimitivesMsaDelegation | null> {
    const delegationResponse = await this.apiPromise.query.msa.delegatorAndProviderToDelegation(msaId, providerId);
    if (delegationResponse.isSome) return delegationResponse.unwrap();
    return null;
  }

  public async publicKeyToMsaId(publicKey: string) {
    this.logger.log(`Public Key To Msa`);

    const handleResponse = await this.query('msa', 'publicKeyToMsaId', publicKey);
    this.logger.log(`Public Key To Msa`, handleResponse.unwrap());

    if (handleResponse.isSome) return handleResponse.unwrap();
    this.logger.log(`Public Key To Msa`);

    return null;
  }

  public async capacityInfo(providerId: number): Promise<{
    providerId: number;
    currentBlockNumber: number;
    nextEpochStart: number;
    remainingCapacity: bigint;
    totalCapacityIssued: bigint;
    currentEpoch: bigint;
  }> {
    const providerU64 = this.api.createType('u64', providerId);
    const { epochStart }: PalletCapacityEpochInfo = await this.query('capacity', 'currentEpochInfo');
    const epochBlockLength: u32 = await this.query('capacity', 'epochLength');
    const capacityDetailsOption: Option<PalletCapacityCapacityDetails> = await this.query(
      'capacity',
      'capacityLedger',
      providerU64,
    );
    const { remainingCapacity, totalCapacityIssued } = capacityDetailsOption.unwrapOr({
      remainingCapacity: 0,
      totalCapacityIssued: 0,
    });
    const currentBlock: u32 = await this.query('system', 'number');
    const currentEpoch = await this.getCurrentCapacityEpoch();
    return {
      currentEpoch,
      providerId,
      currentBlockNumber: currentBlock.toNumber(),
      nextEpochStart: epochStart.add(epochBlockLength).toNumber(),
      remainingCapacity:
        typeof remainingCapacity === 'number' ? BigInt(remainingCapacity) : remainingCapacity.toBigInt(),
      totalCapacityIssued:
        typeof totalCapacityIssued === 'number' ? BigInt(totalCapacityIssued) : totalCapacityIssued.toBigInt(),
    };
  }

  public async getCurrentCapacityEpoch(): Promise<bigint> {
    const currentEpoch: u32 = await this.query('capacity', 'currentEpoch');
    return typeof currentEpoch === 'number' ? BigInt(currentEpoch) : currentEpoch.toBigInt();
  }

  public async getCurrentCapacityEpochStart(): Promise<u32> {
    const currentEpochInfo: PalletCapacityEpochInfo = await this.query('capacity', 'currentEpochInfo');
    return currentEpochInfo.epochStart;
  }

  public async getCurrentEpochLength(): Promise<number> {
    const epochLength: u32 = await this.query('capacity', 'epochLength');
    return typeof epochLength === 'number' ? epochLength : epochLength.toNumber();
  }

  public async crawlBlockListForTx(
    txHash: Hash,
    blockList: bigint[],
    successEvents: [{ pallet: string; event: string }],
  ): Promise<{
    found: boolean;
    success: boolean;
    blockHash?: BlockHash;
    capacityWithDrawn?: string;
    error?: RegistryError;
    events?: Vec<FrameSystemEventRecord>;
  }> {
    const txReceiptPromises: Promise<{
      found: boolean;
      success: boolean;
      blockHash?: BlockHash;
      capacityWithDrawn?: string;
      error?: RegistryError;
      events?: Vec<FrameSystemEventRecord>;
    }>[] = blockList.map(async (blockNumber) => {
      const blockHash = await this.getBlockHash(blockNumber);
      const block = await this.getBlock(blockHash);
      const txInfo = block.block.extrinsics.find((extrinsic) => extrinsic.hash.toString() === txHash.toString());

      if (!txInfo) {
        return { found: false, success: false };
      }

      this.logger.verbose(`Found tx ${txHash} in block ${blockNumber}`);
      const at = await this.api.at(blockHash.toHex());
      const eventsPromise = firstValueFrom(at.query.system.events());

      let isTxSuccess = false;
      let totalBlockCapacity: bigint = 0n;
      let txError: RegistryError | undefined;
      const events = await eventsPromise;

      try {
        events.forEach((record) => {
          const { event } = record;
          const eventName = event.section;
          const { method, data } = event;
          this.logger.debug(`Received event: ${eventName} ${method} ${data}`);

          if (record.event && this.api.events.capacity.CapacityWithdrawn.is(record.event)) {
            const currentCapacity: u128 = record.event.data.amount;
            totalBlockCapacity += currentCapacity.toBigInt();
          }

          // SIWF Events:
          //   MsaCreated
          //   MsaDelegated
          //   HandleClaimed
          if (
            eventName.search('msa') !== -1 &&
            (method.search('MsaCreated') !== -1 || method.search('MsaDelegated') !== -1)
          ) {
            events.push(record);
          }

          // Handle Events:
          //   HandleClaimed
          if (eventName.search('handles') !== -1 && method.search('HandleClaimed') !== -1) {
            events.push(record);
          }

          // Key Events:
          //   KeyAdded
          if (eventName.search('msa') !== -1 && method.search('PublicKeyAdded') !== -1) {
            events.push(record);
          }

          // check custom success events
          if (
            successEvents.find((successEvent) => successEvent.pallet === eventName && successEvent.event === method)
          ) {
            this.logger.debug(`Found success event ${eventName} ${method}`);
            isTxSuccess = true;
          }

          // check for system extrinsic failure
          // TODO: ???refactor to use the api.events.system.ExtrinsicFailed.is(record.event)
          if (eventName.search('system') !== -1 && method.search('ExtrinsicFailed') !== -1) {
            const dispatchError = data[0] as DispatchError;
            const moduleThatErrored = dispatchError.asModule;
            const moduleError = dispatchError.registry.findMetaError(moduleThatErrored);
            txError = moduleError;
            this.logger.error(`Extrinsic failed with error: ${JSON.stringify(moduleError)}`);
          }
        });
      } catch (error) {
        this.logger.error(error);
      }
      this.logger.debug(`Total capacity withdrawn in block: ${totalBlockCapacity.toString()}`);
      return {
        found: true,
        success: isTxSuccess,
        blockHash,
        capacityWithDrawn: totalBlockCapacity.toString(),
        error: txError,
        events,
      };
    });
    const results = await Promise.all(txReceiptPromises);
    const result = results.find((receipt) => receipt.found);
    this.logger.debug(`Found tx receipt: ${JSON.stringify(result)}`);
    return result ?? { found: false, success: false };
  }

  /**
   * Handles the result of a SIWF transaction by extracting relevant values from the transaction events.
   * @param txResultEvents - The transaction result events to process.
   * @returns An object containing the extracted SIWF transaction values.
   */
  public handleSIWFTxnResult = (txResultEvents: Vec<EventRecord>): SIWFTxnValues => {
    const siwfTxnValues: Partial<SIWFTxnValues> = {};

    txResultEvents.forEach((record) => {
      if (record.event && this.api.events.msa.MsaCreated.is(record.event)) {
        siwfTxnValues.msaId = record.event.data.msaId.toString();
        siwfTxnValues.address = record.event.data.key.toString();
      }
      if (record.event && this.api.events.handles.HandleClaimed.is(record.event)) {
        const handleHex = record.event.data.handle.toString();
        // Remove the 0x prefix from the handle and convert the hex handle to a utf-8 string
        const handleData = handleHex.slice(2);
        siwfTxnValues.handle = Buffer.from(handleData.toString(), 'hex').toString('utf-8');
      }

      if (record.event && this.api.events.msa.DelegationGranted.is(record.event)) {
        siwfTxnValues.newProvider = record.event.data.providerId.toString();
        const owner = record.event.data.delegatorId.toString();
        if (owner !== siwfTxnValues.msaId) {
          throw new Error(`DelegationGranted event owner ${owner} does not match msaId ${siwfTxnValues.msaId}`);
        }
      }
    });
    return siwfTxnValues as SIWFTxnValues;
  };

  /**
   * Handles the publish handle transaction result events and extracts the handle and msaId from the event data.
   * @param txResultEvents - The transaction result events to handle.
   * @returns An object containing the extracted handle, msaId, and debug message.
   */
  public handlePublishHandleTxResult = (txResultEvents: Vec<EventRecord>): HandleTxnValues => {
    const handleTxnValues: Partial<HandleTxnValues> = {};

    txResultEvents.forEach((record) => {
      // Grab the handle and msa id from the event data
      if (record.event && this.api.events.handles.HandleClaimed.is(record.event)) {
        const handleHex = record.event.data.handle.toString();
        // Remove the 0x prefix from the handle and convert the hex handle to a utf-8 string
        const handleData = handleHex.slice(2);
        handleTxnValues.handle = Buffer.from(handleData.toString(), 'hex').toString('utf-8');
        handleTxnValues.msaId = record.event.data.msaId.toString();
        handleTxnValues.debugMsg = `Handle created: ${handleTxnValues.handle} for msaId: ${handleTxnValues.msaId}`;
      }
    });

    return handleTxnValues as HandleTxnValues;
  };

  public handlePublishKeyTxResult = (txResultEvents: Vec<EventRecord>): PublicKeyValues => {
    const publicKeyValues: Partial<PublicKeyValues> = {};

    txResultEvents.forEach((record) => {
      // Grab the event data
      if (record.event && this.api.events.msa.PublicKeyAdded.is(record.event)) {
        publicKeyValues.msaId = record.event.data.msaId.toString();
        publicKeyValues.newPublicKey = record.event.data.key.toString();
        publicKeyValues.debugMsg = `Public Key: ${publicKeyValues.newPublicKey} Added for msaId: ${publicKeyValues.msaId}`;
      }
    });

    return publicKeyValues as PublicKeyValues;
  };
}
