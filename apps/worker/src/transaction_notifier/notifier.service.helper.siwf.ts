import { Vec } from '@polkadot/types';
import { IEventData } from '@polkadot/types/types';
import { EventRecord } from '@polkadot/types/interfaces';

interface ReturnValue {
  msaId: string;
  address: string;
  handle: string;
  newProvider: string;
}

export const handleSIWFTxResult = (txResultEvents: Vec<EventRecord>): ReturnValue => {
  let msaId;
  let address;
  let handle;
  let newProvider;

  txResultEvents.forEach((record) => {
    const { method, data, section }: { method: string; data: IEventData; section: string } = record.event;
    if (section.search('msa') !== -1 && method.search('MsaCreated') !== -1) {
      msaId = data[0].toString();
      address = data[1].toString();
    }
    if (section.search('handles') !== -1 && method.search('HandleClaimed') !== -1) {
      // Remove the 0x prefix from the handle
      const handleData = data[1].toString().slice(2);
      // Convert the hex handle to a utf-8 string
      handle = Buffer.from(handleData.toString(), 'hex').toString('utf-8');
    }
    if (section.search('msa') !== -1 && method.search('DelegationGranted') !== -1) {
      newProvider = data[0].toString();
      const owner = data[1].toString();
    }
  });
  return { msaId, address, handle, newProvider };
};
