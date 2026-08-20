import React from 'react';

const Logo = ({ size = 'medium' }) => {
    const isSmall = size === 'small';
    const isLarge = size === 'large';

    const containerSize = isSmall ? '32px' : isLarge ? '52px' : '42px';

    return (
        <img
            src="/logo.png"
            alt="NextStep"
            style={{
                width: containerSize,
                height: containerSize,
                borderRadius: '6px',
                objectFit: 'contain',
                userSelect: 'none',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
        />
    );
};

export default Logo;
