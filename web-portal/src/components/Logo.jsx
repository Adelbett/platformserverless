import React from 'react';

const Logo = ({ size = 'medium' }) => {
    const isSmall = size === 'small';
    const isLarge = size === 'large';
    
    const containerSize = isSmall ? '32px' : isLarge ? '52px' : '42px';
    const fontSize = isSmall ? '18px' : isLarge ? '28px' : '22px';
    const letterSpacing = isSmall ? '-1px' : '-2px';

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: containerSize,
            height: containerSize,
            background: '#0D2B6E', // Deep dark blue background
            borderRadius: '6px',
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: fontSize,
            letterSpacing: letterSpacing,
            userSelect: 'none',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
            <span style={{ color: '#29ABE2', position: 'relative', left: '1px' }}>N</span>
            <span style={{ color: '#FFFFFF', position: 'relative', left: '-1px' }}>S</span>
        </div>
    );
};

export default Logo;
