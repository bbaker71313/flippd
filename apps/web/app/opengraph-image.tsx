import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#3a2410',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '72px 80px',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Scan bracket — top-left */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 40,
            width: 32,
            height: 32,
            borderTop: '3px solid #00bb66',
            borderLeft: '3px solid #00bb66',
          }}
        />
        {/* Scan bracket — top-right */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 40,
            width: 32,
            height: 32,
            borderTop: '3px solid #00bb66',
            borderRight: '3px solid #00bb66',
          }}
        />
        {/* Scan bracket — bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 40,
            width: 32,
            height: 32,
            borderBottom: '3px solid #00bb66',
            borderLeft: '3px solid #00bb66',
          }}
        />
        {/* Scan bracket — bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            right: 40,
            width: 32,
            height: 32,
            borderBottom: '3px solid #00bb66',
            borderRight: '3px solid #00bb66',
          }}
        />

        {/* Logo wordmark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 40,
          }}
        >
          {/* Bar chart icon */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
            <div style={{ width: 10, height: 16, background: '#00bb66' }} />
            <div style={{ width: 10, height: 26, background: '#00bb66' }} />
            <div style={{ width: 10, height: 38, background: '#00bb66' }} />
          </div>
          <span
            style={{
              color: '#f5f5f4',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            SCANFORPROFIT
          </span>
        </div>

        {/* Main headline */}
        <div
          style={{
            color: '#f5f5f4',
            fontSize: 62,
            fontWeight: 800,
            lineHeight: 1.05,
            marginBottom: 24,
            maxWidth: 680,
          }}
        >
          Still guessing
          <br />
          what to flip?
        </div>

        <div
          style={{
            color: '#a8987e',
            fontSize: 24,
            fontWeight: 400,
            marginBottom: 48,
            maxWidth: 540,
            lineHeight: 1.4,
          }}
        >
          Scan any item. Know your profit before you pay.
        </div>

        {/* Scan result card */}
        <div
          style={{
            position: 'absolute',
            right: 80,
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#1e1208',
            border: '1px solid rgba(0,187,102,0.3)',
            borderRadius: 12,
            padding: '28px 32px',
            width: 320,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <span style={{ color: '#6b5035', fontSize: 11, letterSpacing: '0.15em', fontWeight: 500 }}>
              SCAN RESULT
            </span>
            <span
              style={{
                color: '#00bb66',
                fontSize: 11,
                fontWeight: 700,
                border: '1px solid #00bb66',
                padding: '3px 10px',
                borderRadius: 3,
                letterSpacing: '0.15em',
              }}
            >
              BUY
            </span>
          </div>

          <span style={{ color: '#f5f5f4', fontSize: 15, fontWeight: 600, marginBottom: 20 }}>
            Vintage Cast Iron Skillet
          </span>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#6b5035', fontSize: 12 }}>You pay</span>
            <span style={{ color: '#f5f5f4', fontSize: 12 }}>$4.00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ color: '#6b5035', fontSize: 12 }}>Est. sell</span>
            <span style={{ color: '#f5f5f4', fontSize: 12 }}>$47.00</span>
          </div>

          <div
            style={{
              borderTop: '1px solid rgba(200,184,154,0.2)',
              paddingTop: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span style={{ color: '#6b5035', fontSize: 10, letterSpacing: '0.1em' }}>PROFIT AFTER FEES</span>
            <span style={{ color: '#00bb66', fontSize: 32, fontWeight: 800 }}>+$38.50</span>
          </div>

          <span style={{ color: '#6b5035', fontSize: 10, marginTop: 10 }}>
            6.2s · 12 sold last 90 days · eBay comps
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
