import { useEffect, useState } from 'react';
import { isViewTransitionSupported } from '@/utils/view-transition';

export function ViewTransitionDemo() {
  const [isSupported, setIsSupported] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setIsSupported(isViewTransitionSupported());
  }, []);

  if (!isClient) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        padding: '8px 12px',
        backgroundColor: isSupported ? '#22ba85' : '#f59e0b',
        color: 'white',
        borderRadius: '6px',
        fontSize: '12px',
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}
    >
      View Transitions: {isSupported ? '✅ Supported' : '⚠️ Not Supported'}
    </div>
  );
}
