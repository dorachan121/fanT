import { GRADE_SKSL, LUMA_SKSL } from '../sksl';

/**
 * `detail_v1`: the editor's detailed adjustments, after the basic ones and the
 * skin retouching: local areas (EDT-10), the tone curve (EDT-09), highlights and
 * shadows, colour bands (EDT-08), vibrance and sharpening (EDT-07).
 *
 * Uniform names must match `DetailUniforms`; a test checks that they stay in sync.
 */
export const DETAIL_SHADER_NAME = 'detail_v1';

export const DETAIL_SHADER_SOURCE = /* sksl */ `
uniform shader image;
uniform float2 resolution;
uniform float sharpen;
uniform float highlights;
uniform float shadows;
uniform float vibrance;
// Tone curve: shadows, darks, lights, highlights.
uniform float4 curve;
// Colour bands red, orange, yellow, green (A) and aqua, blue, purple, magenta (B).
uniform float4 hueA;
uniform float4 hueB;
uniform float4 saturationA;
uniform float4 saturationB;
uniform float4 luminanceA;
uniform float4 luminanceB;
// Local areas: (x, y, radius, feather) in photo fractions and (brightness,
// saturation, temperature, 1 if present).
uniform float4 local0Area;
uniform float4 local0Adjust;
uniform float4 local1Area;
uniform float4 local1Adjust;
uniform float4 local2Area;
uniform float4 local2Adjust;
uniform float4 local3Area;
uniform float4 local3Adjust;
${LUMA_SKSL}
${GRADE_SKSL}
// Sharpening radius as a fraction of the short edge, the same in preview and photo.
const float SHARPEN_RADIUS = 0.0012;

half3 rgbToHsv(half3 c) {
  half4 k = half4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  half4 p = mix(half4(c.bg, k.wz), half4(c.gb, k.xy), step(c.b, c.g));
  half4 q = mix(half4(p.xyw, c.r), half4(c.r, p.yzx), step(p.x, c.r));
  half d = q.x - min(q.w, q.y);
  half e = 1.0e-4;
  return half3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

half3 hsvToRgb(half3 c) {
  half4 k = half4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  half3 p = abs(fract(c.xxx + k.xyz) * 6.0 - k.www);
  return c.z * mix(k.xxx, saturate(p - k.xxx), c.y);
}

// How much a hue (0-1) belongs to a band centred at 'centre' with half-width 'width'.
half bandWeight(half hue, half centre, half width) {
  half d = abs(hue - centre);
  d = min(d, 1.0 - d);
  return saturate(1.0 - d / width);
}

half3 colourBands(half3 color) {
  half3 hsv = rgbToHsv(saturate(color));
  // Grey has no hue: the bands fade out as saturation drops.
  half amount = smoothstep(0.05, 0.3, hsv.y);
  if (amount <= 0.0) return color;
  half4 wA = half4(
    bandWeight(hsv.x, 0.0, 0.07), bandWeight(hsv.x, 0.083, 0.06),
    bandWeight(hsv.x, 0.16, 0.08), bandWeight(hsv.x, 0.33, 0.12));
  half4 wB = half4(
    bandWeight(hsv.x, 0.5, 0.1), bandWeight(hsv.x, 0.61, 0.1),
    bandWeight(hsv.x, 0.75, 0.08), bandWeight(hsv.x, 0.88, 0.08));
  half total = dot(wA, half4(1.0)) + dot(wB, half4(1.0));
  if (total <= 0.0) return color;
  wA /= total;
  wB /= total;
  half hueShift = dot(wA, half4(hueA)) + dot(wB, half4(hueB));
  half satShift = dot(wA, half4(saturationA)) + dot(wB, half4(saturationB));
  half lumShift = dot(wA, half4(luminanceA)) + dot(wB, half4(luminanceB));
  hsv.x = fract(hsv.x + hueShift * 0.08 * amount);
  hsv.y = saturate(hsv.y * (1.0 + satShift * amount));
  hsv.z = saturate(hsv.z * (1.0 + lumShift * 0.3 * amount));
  return hsvToRgb(hsv);
}

// A smooth bump of width 1/4 centred at 'centre'.
half bump(half x, half centre) {
  half t = saturate(1.0 - abs(x - centre) * 4.0);
  return t * t * (3.0 - 2.0 * t);
}

half curveOf(half x) {
  half lift = half(curve.x) * bump(x, 0.125) + half(curve.y) * bump(x, 0.375)
    + half(curve.z) * bump(x, 0.625) + half(curve.w) * bump(x, 0.875);
  return saturate(x + lift * 0.12);
}

half3 local(half3 color, float2 uv, float aspect, float4 area, float4 adjust) {
  if (adjust.w < 0.5) return color;
  // Distance in short-edge units, so the area is a circle on the photo.
  float2 d = (uv - area.xy) * (aspect > 1.0 ? float2(aspect, 1.0) : float2(1.0, 1.0 / aspect));
  float r = max(area.z, 1e-4);
  half weight = half(1.0 - smoothstep(r * (1.0 - area.w), r, length(d)));
  if (weight <= 0.0) return color;
  half3 adjusted = color * half(exp2(adjust.x));
  adjusted = grade(adjusted, adjust.z, 0.0, adjust.y, 0.0, 0.0);
  return mix(color, adjusted, weight);
}

half4 main(float2 coord) {
  half4 source = unpremul(image.eval(coord));
  half3 color = source.rgb;
  float shortEdge = min(resolution.x, resolution.y);

  if (sharpen > 0.0) {
    float r = max(1.0, SHARPEN_RADIUS * shortEdge);
    half3 blur = (unpremul(image.eval(coord + float2(r, 0.0))).rgb
      + unpremul(image.eval(coord - float2(r, 0.0))).rgb
      + unpremul(image.eval(coord + float2(0.0, r))).rgb
      + unpremul(image.eval(coord - float2(0.0, r))).rgb) * 0.25;
    color += (color - blur) * half(sharpen * 1.5);
  }

  float2 uv = coord / resolution;
  float aspect = resolution.x / resolution.y;
  color = local(color, uv, aspect, local0Area, local0Adjust);
  color = local(color, uv, aspect, local1Area, local1Adjust);
  color = local(color, uv, aspect, local2Area, local2Adjust);
  color = local(color, uv, aspect, local3Area, local3Adjust);

  if (any(notEqual(curve, float4(0.0)))) {
    color = half3(curveOf(color.r), curveOf(color.g), curveOf(color.b));
  }

  half luma = dot(saturate(color), LUMA);
  // Shadows act on the dark third, highlights on the bright third.
  half shadowWeight = (1.0 - luma) * (1.0 - luma) * (1.0 - luma);
  half highlightWeight = luma * luma * luma;
  color *= 1.0 + half(shadows) * shadowWeight * 0.8 + half(highlights) * highlightWeight * 0.4;

  if (any(notEqual(hueA, float4(0.0))) || any(notEqual(hueB, float4(0.0)))
      || any(notEqual(saturationA, float4(0.0))) || any(notEqual(saturationB, float4(0.0)))
      || any(notEqual(luminanceA, float4(0.0))) || any(notEqual(luminanceB, float4(0.0)))) {
    color = colourBands(color);
  }

  if (vibrance != 0.0) {
    half grey = dot(color, LUMA);
    half saturation = max(max(color.r, color.g), color.b) - min(min(color.r, color.g), color.b);
    // Dull colours gain the most; vivid ones are left nearly alone.
    color = mix(half3(grey), color, 1.0 + half(vibrance) * (1.0 - saturate(saturation)));
  }

  return half4(saturate(color) * source.a, source.a);
}
`;
