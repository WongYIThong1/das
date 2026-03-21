import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '365BIZ AI — AI Accounting System';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#09090b',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle radial glow behind logo */}
        <div
          style={{
            position: 'absolute',
            width: '480px',
            height: '480px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -60%)',
          }}
        />

        {/* Bot icon (lucide Bot SVG, inlined) */}
        <div
          style={{
            width: '96px',
            height: '96px',
            borderRadius: '24px',
            background: '#18181b',
            border: '1.5px solid #3f3f46',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '36px',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="52"
            height="52"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '64px',
            fontWeight: '700',
            color: '#ffffff',
            letterSpacing: '-1px',
            marginBottom: '16px',
            display: 'flex',
          }}
        >
          365BIZ AI
        </div>

        {/* Divider */}
        <div
          style={{
            width: '48px',
            height: '2px',
            background: '#3f3f46',
            borderRadius: '2px',
            marginBottom: '20px',
          }}
        />

        {/* Tagline */}
        <div
          style={{
            fontSize: '26px',
            color: '#a1a1aa',
            fontWeight: '400',
            letterSpacing: '0px',
            display: 'flex',
          }}
        >
          AI Accounting System
        </div>

        {/* Bottom domain badge */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '20px',
            padding: '8px 20px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#22c55e',
              display: 'flex',
            }}
          />
          <span style={{ color: '#71717a', fontSize: '16px', display: 'flex' }}>
            dash.my365biz.com
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
