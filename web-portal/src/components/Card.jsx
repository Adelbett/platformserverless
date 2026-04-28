import React from 'react';

const Card = ({ children, title, action, style = {}, className = '' }) => {
    return (
        <div className={`glass-panel ${className}`} style={{ padding: '24px', ...style }}>
            {(title || action) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    {title && <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>{title}</h3>}
                    {action && <div>{action}</div>}
                </div>
            )}
            {children}
        </div>
    );
};

export default Card;
