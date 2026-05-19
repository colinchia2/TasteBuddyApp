import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Ellipse } from 'react-native-svg';

export default function TBLogo({ size = 80, style }) {
  return (
    <View style={[{ width: size, height: size }, styles.shadow, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Face */}
        <Circle cx="50" cy="50" r="45" fill="#FFD93D" />
        {/* Left eye arc */}
        <Path d="M25 40 Q32 32 40 40" stroke="#5D4E37" strokeWidth="4" fill="none" strokeLinecap="round" />
        {/* Right eye arc */}
        <Path d="M60 40 Q67 32 75 40" stroke="#5D4E37" strokeWidth="4" fill="none" strokeLinecap="round" />
        {/* Smile */}
        <Path d="M25 55 Q50 85 75 55" stroke="#5D4E37" strokeWidth="4" fill="none" strokeLinecap="round" />
        {/* Tongue */}
        <Ellipse cx="50" cy="72" rx="12" ry="15" fill="#FF6B6B" />
        {/* Tongue center line */}
        <Path d="M50 65 L50 80" stroke="#E55555" strokeWidth="2" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#C8960C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
});
