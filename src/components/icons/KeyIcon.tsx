import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface KeyIconProps {
    size?: number;
    color?: string;
}

/**
 * Key icon inspired by iconic.app - simple, clean login/authentication icon
 * https://iconic.app/key/
 * Diagonal key with circular head and simple teeth
 */
export const KeyIcon: React.FC<KeyIconProps> = ({ size = 24, color = '#1a1a1a' }) => {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            {/* Circular key head/bow */}
            <Circle
                cx="8"
                cy="8"
                r="3.25"
                stroke={color}
                strokeWidth={1.5}
            />
            {/* Key shaft going diagonal */}
            <Path
                d="M10.5 10.5L19 19"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
            />
            {/* Key teeth */}
            <Path
                d="M17 17L17 20"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
            />
            <Path
                d="M14 14L14 16"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
            />
        </Svg>
    );
};

