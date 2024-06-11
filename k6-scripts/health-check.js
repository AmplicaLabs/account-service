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
import { check, sleep } from 'k6';

export const options = {
  vus: 100,
  duration: '10s',
  thresholds: {
    http_req_duration: ['avg<100', 'p(95)<200'],
  },
  noConnectionReuse: true,
};

const BASE_URL = 'http://localhost:3000';
// Sleep duration between successive requests.
const SLEEP_DURATION = 0.1;

export default function () {
  // Request No. 1: ApiController_health
  // eslint-disable-next-line no-lone-blocks
  const url = `${BASE_URL}/api/health`;
  const request = http.get(url);

  check(request, {
    'Service is healthy': (r) => r.status === 200,
  });
  sleep(SLEEP_DURATION);
}