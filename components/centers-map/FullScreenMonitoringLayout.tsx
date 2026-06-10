import React, { useEffect } from 'react';

export const FullScreenMonitoringLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyMargin = body.style.margin;
    const previousRootHeight = root?.style.height || '';

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.margin = '0';
    if (root) root.style.height = '100%';

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.margin = previousBodyMargin;
      if (root) root.style.height = previousRootHeight;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 h-screen w-screen overflow-hidden bg-[#d6eef8]"
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
};
