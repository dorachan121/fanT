import { DEFAULT_FILM_PARAMS, toFilmUniforms } from '@fant/filters';
import { Canvas, Fill, LinearGradient, Shader, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useFilmEffect } from './use-film-effect';

interface Size {
  readonly width: number;
  readonly height: number;
}

/** Stand-in for the camera feed until VisionCamera is wired in (M1 PoC). */
const SAMPLE_COLORS = ['#f6d365', '#fda085', '#5b8cff'];

export function FilmPreview() {
  const effect = useFilmEffect();
  const [size, setSize] = useState<Size | null>(null);
  const [seed] = useState(Math.random);

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setSize(width > 0 && height > 0 ? { width, height } : null);
  };

  return (
    <View style={styles.fill} onLayout={handleLayout}>
      {size && (
        <Canvas style={styles.fill}>
          <Fill>
            <Shader
              source={effect}
              uniforms={toFilmUniforms(DEFAULT_FILM_PARAMS, { ...size, seed })}
            >
              <LinearGradient
                start={vec(0, 0)}
                end={vec(size.width, size.height)}
                colors={SAMPLE_COLORS}
              />
            </Shader>
          </Fill>
        </Canvas>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
