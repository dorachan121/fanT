import AVFoundation
import CoreImage
import ExpoModulesCore
import UIKit

/// Colours short videos with a film's 3D LUT (CAM-13), on the device: every frame
/// goes through Core Image's colour cube while AVFoundation re-encodes the video,
/// keeping its sound and orientation.
public class VideoFilmModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VideoFilm")

    AsyncFunction("applyLut") {
      (inputUri: String, outputUri: String, size: Int, rgbaBase64: String, promise: Promise) in
      guard let input = URL(string: inputUri), input.isFileURL,
        let output = URL(string: outputUri), output.isFileURL,
        let rgba = Data(base64Encoded: rgbaBase64), size >= 2, rgba.count == size * size * size * 4
      else {
        promise.reject("E_VIDEO_ARGS", "Invalid video or LUT")
        return
      }
      Self.applyLut(input: input, output: output, size: size, rgba: rgba, promise: promise)
    }

    AsyncFunction("thumbnail") { (videoUri: String, jpegUri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        guard let video = URL(string: videoUri), video.isFileURL,
          let jpeg = URL(string: jpegUri), jpeg.isFileURL
        else {
          promise.reject("E_VIDEO_ARGS", "Invalid file")
          return
        }
        let asset = AVURLAsset(url: video)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        do {
          let image = try generator.copyCGImage(at: .zero, actualTime: nil)
          guard let data = UIImage(cgImage: image).jpegData(compressionQuality: 0.9) else {
            promise.reject("E_VIDEO_THUMBNAIL", "Could not encode the thumbnail")
            return
          }
          try data.write(to: jpeg)
          promise.resolve([
            "width": image.width,
            "height": image.height,
            "durationMs": Int(CMTimeGetSeconds(asset.duration) * 1000),
          ])
        } catch {
          promise.reject("E_VIDEO_THUMBNAIL", error.localizedDescription)
        }
      }
    }
  }

  /// The film shader's layout (x = blue slice × size + red, y = green) as Core Image's
  /// colour cube (red fastest, then green, then blue).
  private static func cubeData(size: Int, rgba: Data) -> Data {
    var cube = [Float](repeating: 0, count: size * size * size * 4)
    rgba.withUnsafeBytes { (bytes: UnsafeRawBufferPointer) in
      for b in 0..<size {
        for g in 0..<size {
          for r in 0..<size {
            let source = (g * size * size + b * size + r) * 4
            let target = (b * size * size + g * size + r) * 4
            for channel in 0..<3 {
              cube[target + channel] = Float(bytes[source + channel]) / 255
            }
            cube[target + 3] = 1
          }
        }
      }
    }
    return cube.withUnsafeBufferPointer { Data(buffer: $0) }
  }

  private static func applyLut(input: URL, output: URL, size: Int, rgba: Data, promise: Promise) {
    let cube = cubeData(size: size, rgba: rgba)
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else {
      promise.reject("E_VIDEO_LUT", "No sRGB colour space")
      return
    }
    let asset = AVURLAsset(url: input)
    let composition = AVMutableVideoComposition(asset: asset) { request in
      let source = request.sourceImage.clampedToExtent()
      let coloured = source.applyingFilter(
        "CIColorCubeWithColorSpace",
        parameters: [
          "inputCubeDimension": size,
          "inputCubeData": cube,
          "inputColorSpace": colorSpace,
        ])
      request.finish(with: coloured.cropped(to: request.sourceImage.extent), context: nil)
    }
    guard
      let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHighestQuality)
    else {
      promise.reject("E_VIDEO_EXPORT", "Could not create an export session")
      return
    }
    try? FileManager.default.removeItem(at: output)
    export.videoComposition = composition
    export.outputURL = output
    export.outputFileType = .mp4
    export.shouldOptimizeForNetworkUse = true
    export.exportAsynchronously {
      switch export.status {
      case .completed:
        promise.resolve(nil)
      default:
        promise.reject(
          "E_VIDEO_EXPORT", export.error?.localizedDescription ?? "The video could not be exported")
      }
    }
  }
}
