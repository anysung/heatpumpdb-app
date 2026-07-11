/**
 * paddleService — web billing via Paddle (merchant of record).
 *
 * The app is NOT distributed through app stores; subscriptions are sold on
 * the web. Paddle handles payment methods, EU VAT, invoices/receipts and the
 * customer self-service flows — we never store card data, and the only
 * billing identifiers kept on the user profile are the Paddle customer /
 * subscription ids (written by the payment webhook, server-side).
 *
 * Configuration (public, per environment):
 *   VITE_PADDLE_CLIENT_TOKEN — publishable client token ('test_…' = sandbox)
 *   VITE_PADDLE_PRICE_ID     — the Pro subscription price id for this market
 * Unconfigured builds keep the UI functional with a "coming soon" outcome.
 */
import { PUBLIC_ENV } from '../config/env';
import { User } from '../types';

declare global {
  // Paddle.js v2 global (loaded on demand from Paddle's CDN).
  interface Window { Paddle?: any }
}

export const paddleConfigured =
  !!(PUBLIC_ENV.PADDLE_CLIENT_TOKEN && PUBLIC_ENV.PADDLE_PRICE_ID);

let loader: Promise<any> | null = null;

/** Load + initialize Paddle.js v2 once. Rejects if unconfigured or blocked. */
function loadPaddle(): Promise<any> {
  if (!paddleConfigured) return Promise.reject(new Error('paddle-not-configured'));
  if (window.Paddle) return Promise.resolve(window.Paddle);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    s.async = true;
    s.onload = () => {
      try {
        if (PUBLIC_ENV.PADDLE_CLIENT_TOKEN.startsWith('test_')) {
          window.Paddle.Environment.set('sandbox');
        }
        window.Paddle.Initialize({ token: PUBLIC_ENV.PADDLE_CLIENT_TOKEN });
        resolve(window.Paddle);
      } catch (e) { reject(e); }
    };
    s.onerror = () => reject(new Error('paddle-load-failed'));
    document.head.appendChild(s);
  });
  return loader;
}

/**
 * Open the Paddle overlay checkout for the Pro subscription.
 * customData.userId lets the payment webhook attach the subscription to the
 * Firebase account regardless of the email used at checkout.
 */
export async function openCheckout(user: User): Promise<void> {
  const paddle = await loadPaddle();
  paddle.Checkout.open({
    items: [{ priceId: PUBLIC_ENV.PADDLE_PRICE_ID, quantity: 1 }],
    customer: user.email ? { email: user.email } : undefined,
    customData: { userId: user.id, country: user.country ?? '' },
    settings: { displayMode: 'overlay', theme: 'dark' },
  });
}

/**
 * Paddle's hosted customer portal (cancel / payment method / invoices).
 * The per-customer portal URL is minted server-side from the Paddle API and
 * stored on the profile by the billing webhook; absent → not yet available.
 */
export function portalUrlFor(user: User): string | null {
  return user.paddlePortalUrl ?? null;
}
