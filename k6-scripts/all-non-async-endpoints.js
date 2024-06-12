/* eslint-disable import/no-unresolved */
/* eslint-disable func-names */
/*
 * Account Service
 * Account Service API
 *
 * OpenAPI spec version: 1.0
 *
 * NOTE: This class is auto generated by OpenAPI Generator.
 * https://github.com/OpenAPITools/openapi-generator
 *
 * Generator version: 7.7.0-SNAPSHOT
 */

import http from 'k6/http';
import { group, check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '10s',
  thresholds: {
    http_req_duration: ['avg<100', 'p(95)<200'],
  },
  noConnectionReuse: true,
};

const BASE_URL = 'http://localhost:3000';
// Sleep duration between successive requests.
const SLEEP_DURATION = 0.1;
// Global variables should be initialized.

export default function () {
  group('/accounts/siwf', () => {
    // Request No. 1: AccountsController_getSIWFConfig
    const url = `${BASE_URL}/accounts/siwf`;
    const request = http.get(url);

    check(request, {
      'Returned SIWF Configuration data': (r) => r.status === 200,
    });

    sleep(SLEEP_DURATION);
  });

  group('/delegation/{msaId}', () => {
    const msaId = '2';

    // Request No. 1: DelegationController_getDelegation
    {
      const url = `${BASE_URL}/delegation/${msaId}`;
      const request = http.get(url);

      check(request, {
        'Found delegation information.': (r) => r.status === 200,
      });
    }
  });

  group('/keys/{msaId}', () => {
    const msaId = '2';

    // Request No. 1: KeysController_getKeys
    {
      const url = `${BASE_URL}/keys/${msaId}`;
      const request = http.get(url);

      check(request, {
        'Found public keys.': (r) => r.status === 200,
      });
    }
  });

  group('/handles/change', () => {
    // Request No. 1: HandlesController_changeHandle
    // eslint-disable-next-line no-lone-blocks
    {
      const url = `${BASE_URL}/handles/change`;
      // TODO: edit the parameters of the request body.
      const body = {
        accountId: 'string',
        payload: { baseHandle: 'string', expiration: 'bigdecimal' },
        proof: 'object',
      };
      const params = { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } };
      const request = http.post(url, JSON.stringify(body), params);

      check(request, {
        'Handle changed successfully': (r) => r.status === 200,
      });
    }
  });

  group('/api/health', () => {
    // Request No. 1: ApiController_health
    // eslint-disable-next-line no-lone-blocks
    {
      const url = `${BASE_URL}/api/health`;
      const request = http.get(url);

      check(request, {
        'Service is healthy': (r) => r.status === 200,
      });
    }
  });

  group('/keys/add', () => {
    // Request No. 1: KeysController_addKey
    // eslint-disable-next-line no-lone-blocks
    {
      const url = `${BASE_URL}/keys/add`;
      // TODO: edit the parameters of the request body.
      const body = {
        msaOwnerAddress: 'string',
        msaOwnerSignature: 'object',
        newKeyOwnerSignature: 'object',
        payload: { msaId: 'bigdecimal', expiration: 'bigdecimal', newPublicKey: 'string' },
      };
      const params = { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } };
      const request = http.post(url, JSON.stringify(body), params);

      check(request, {
        'Found public keys.': (r) => r.status === 200,
      });
    }
  });

  group('/accounts/{msaId}', () => {
    const msaId = '1';

    // Request No. 1: AccountsController_getAccount
    {
      const url = `${BASE_URL}/accounts/${msaId}`;
      const request = http.get(url);

      check(request, {
        'Found account': (r) => r.status === 200,
      });
    }
  });

  group('/handles', () => {
    // Request No. 1: HandlesController_createHandle
    // eslint-disable-next-line no-lone-blocks
    {
      const url = `${BASE_URL}/handles`;
      // TODO: edit the parameters of the request body.
      const body = {
        accountId: 'string',
        payload: { baseHandle: 'string', expiration: 'bigdecimal' },
        proof: 'object',
      };
      const params = { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } };
      const request = http.post(url, JSON.stringify(body), params);

      check(request, {
        'Handle created successfully': (r) => r.status === 200,
      });
    }
  });

  group('/handles/{msaId}', () => {
    const msaId = '1';

    // Request No. 1: HandlesController_getHandle
    {
      const url = `${BASE_URL}/handles/${msaId}`;
      const request = http.get(url);

      check(request, {
        'Found account': (r) => r.status === 200,
      });
    }
  });
}
