import React from 'react';

interface DebugInfoProps {
  isVisible?: boolean;
}

export const DebugInfo: React.FC<DebugInfoProps> = ({ isVisible = false }) => {
  if (!isVisible) return null;

  const envInfo = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'Set' : 'Missing',
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing',
    NODE_ENV: import.meta.env.MODE,
    BASE_URL: import.meta.env.BASE_URL,
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 9999,
      maxWidth: '300px',
    }}>
      <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>Debug Info</div>
      {Object.entries(envInfo).map(([key, value]) => (
        <div key={key} style={{ marginBottom: '2px' }}>
          {key}: {value}
        </div>
      ))}
      <div style={{ marginTop: '10px', fontSize: '10px' }}>
        Time: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}; 