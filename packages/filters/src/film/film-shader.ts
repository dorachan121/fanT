/**
 * `film_v1`: the base film look applied on top of the camera image.
 *
 * Uniform names must match `FilmUniforms`; a test compiles this source and
 * checks that the two stay in sync.
 */
export const FILM_SHADER_NAME = 'film_v1';

export const FILM_SHADER_SOURCE = /* sksl */ `
uniform shader image;
uniform float2 resolution;
uniform float intensity;
uniform float warmth;
uniform float fade;
uniform float vignette;
uniform float grain;
uniform float seed;

const half3 LUMA = half3(0.2126, 0.7152, 0.0722);

// Per-pixel hash in [0, 1), stable for a given seed.
float hash(float2 p) {
  float3 p3 = fract(float3(p.xyx) * 0.1031 + seed);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

half4 main(float2 coord) {
  half4 source = unpremul(image.eval(coord));
  half3 color = source.rgb;

  // Warmth: push red up and blue down.
  color += half3(warmth, 0.0, -warmth) * 0.08;

  // Fade: lift the blacks.
  color = mix(color, color * 0.85 + 0.15, half(fade));

  // Vignette: darken towards the corners.
  float edge = smoothstep(0.35, 0.85, distance(coord / resolution, float2(0.5)));
  color *= half(1.0 - vignette * edge);

  // Grain: stronger in the shadows than in the highlights.
  half luma = dot(color, LUMA);
  half noise = half(hash(floor(coord)) - 0.5);
  color += noise * half(grain) * 0.25 * (1.0 - luma * 0.5);

  color = mix(source.rgb, saturate(color), half(intensity));
  return half4(color * source.a, source.a);
}
`;
