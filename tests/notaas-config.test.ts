import assert from 'node:assert/strict';
import test from 'node:test';
import { lerConfiguracao } from '../netlify/lib/notaas.ts';

test('emissão fiscal só habilita com emissor, chave de servidor e alíquota explícitos', () => {
  const keys = ['NOTAAS_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NOTAAS_ALLOWED_USER_ID', 'NOTAAS_ALIQUOTA_ISS'];
  const anteriores = new Map(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.NOTAAS_API_KEY = 'REDACTED';
    process.env.SUPABASE_URL = 'https://example.invalid';
    process.env.SUPABASE_ANON_KEY = 'REDACTED';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'REDACTED';
    process.env.NOTAAS_ALLOWED_USER_ID = '00000000-0000-4000-8000-000000000000';
    process.env.NOTAAS_ALIQUOTA_ISS = '';
    assert.equal(lerConfiguracao(), null);

    process.env.NOTAAS_ALIQUOTA_ISS = '0';
    assert.equal(lerConfiguracao()?.aliquotaIss, 0);

    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal(lerConfiguracao(), null);
  } finally {
    for (const [key, value] of anteriores) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
