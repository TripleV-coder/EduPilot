import { test, expect } from '@playwright/test';

/**
 * E2E — API Security tests
 * Vérifie que les endpoints sensibles nécessitent une authentification
 * et que les webhooks de paiement vérifient la signature.
 */

test.describe('API — Protection des endpoints sensibles', () => {
    const sensitiveEndpoints = [
        { method: 'GET', path: '/api/users' },
        { method: 'GET', path: '/api/students' },
        { method: 'GET', path: '/api/teachers' },
        { method: 'GET', path: '/api/grades' },
        { method: 'GET', path: '/api/finance/payments' },
        { method: 'GET', path: '/api/analytics' },
        { method: 'GET', path: '/api/audit-logs' },
        { method: 'GET', path: '/api/compliance/dashboard' },
        { method: 'GET', path: '/api/medical-records' },
    ];

    for (const { method, path } of sensitiveEndpoints) {
        test(`${method} ${path} — retourne 401 sans auth`, async ({ request }) => {
            const res = await request[method.toLowerCase() as 'get'](path);
            expect([401, 403]).toContain(res.status());
        });
    }
});

test.describe('API — Webhook paiement', () => {
    test('POST /api/payments/webhook sans signature → 401', async ({ request }) => {
        const res = await request.post('/api/payments/webhook', {
            data: { id: 'fake-tx-123', status: 'successful' },
        });
        // Sans header de signature → doit être refusé
        expect([401, 403]).toContain(res.status());
    });

    test('POST /api/payments/webhook avec signature invalide → 401', async ({ request }) => {
        const res = await request.post('/api/payments/webhook', {
            data: { id: 'fake-tx-123', status: 'successful' },
            headers: {
                'verif-hash': 'invalidsignature',
            },
        });
        expect([401, 403]).toContain(res.status());
    });
});

test.describe('API — Rate limiting', () => {
    test('POST /api/auth/forgot-password — bloqué après trop de tentatives', async ({ request }) => {
        const email = `test-rl-${Date.now()}@example.com`;
        let lastStatus = 200;

        // Envoyer plusieurs requêtes jusqu'à atteindre la limite
        for (let i = 0; i < 5; i++) {
            const res = await request.post('/api/auth/forgot-password', {
                data: { email },
            });
            lastStatus = res.status();
            if (lastStatus === 429) break;
        }

        expect(lastStatus).toBe(429);
    });
});

test.describe('API — Headers de sécurité', () => {
    test('la page de login inclut les headers de sécurité', async ({ request }) => {
        const res = await request.get('/login');
        expect(res.status()).toBe(200);

        const headers = res.headers();
        // Vérifier X-Frame-Options ou CSP
        const hasFrameProtection =
            headers['x-frame-options'] !== undefined ||
            (headers['content-security-policy'] || '').includes('frame');
        expect(hasFrameProtection).toBe(true);

        expect(headers['x-content-type-options']).toBe('nosniff');
    });
});
