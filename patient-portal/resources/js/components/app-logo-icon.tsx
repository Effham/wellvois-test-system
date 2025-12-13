import React from 'react';

interface AppLogoIconProps extends React.HTMLAttributes<HTMLImageElement> {
    collapsed?: boolean;
}

export default function AppLogoIcon({ collapsed = false, ...props }: AppLogoIconProps) {
    return <img {...props} className='h-7 w-auto max-w-full' src={collapsed ? '/brand/images/Vector.svg' : '/brand/images/mainLogo.png'} alt="App Logo" />;
}
