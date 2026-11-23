// Cuts the five surah banners of docs/design/surah-banners-reference.jpg into the pieces the reader draws:
// for each, the left and right wings (the ornament and the medallion, the medallion's digits painted out) and a
// strip of the centre panel that the reader stretches between them. The surah name and the two numbers are drawn
// by the app over these pieces, in every surah.
//
//   swift scripts/make_surah_banners.swift docs/design/surah-banners-reference.jpg Sources/Assets.xcassets
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct Banner {
    let index: Int
    /// The banner's body in the reference, edges excluded.
    let top: Int, bottom: Int
    /// The medallion's centre and the radius painted out (the digits sit inside it).
    let medallionX: Int, paintRadius: Double
    /// Where the left wing ends; the right wing mirrors it.
    let wingEnd: Int
    /// Where the centre strip is sampled from, inside the wing's end; the percentile of each row's colours taken
    /// (below 0.5 drops light pattern lines), and how many rows the strip is smoothed over.
    var sample: ClosedRange<Int>? = nil
    var percentile = 0.5
    var smoothing = 1
    /// How many columns at the wing's end fade into the strip.
    var feather = 36
}

// Measured on the reference (2528 × 1696): every banner runs x 392…2331 with a body 261 px tall.
let left = 395, right = 2328
let banners = [
    Banner(index: 1, top: 128, bottom: 382, medallionX: 655, paintRadius: 56, wingEnd: 1000,
           percentile: 0.15, smoothing: 18),
    Banner(index: 2, top: 427, bottom: 682, medallionX: 653, paintRadius: 58, wingEnd: 800),
    Banner(index: 3, top: 727, bottom: 981, medallionX: 711, paintRadius: 56, wingEnd: 905),
    Banner(index: 4, top: 1026, bottom: 1281, medallionX: 715, paintRadius: 60, wingEnd: 830, smoothing: 12),
    Banner(index: 5, top: 1324, bottom: 1580, medallionX: 713, paintRadius: 55, wingEnd: 925,
           sample: 960...1040, feather: 10),
]
let window = 50

let args = CommandLine.arguments
guard args.count == 3 else { print("usage: make_surah_banners.swift <reference.jpg> <Assets.xcassets>"); exit(2) }
let source = CGImageSourceCreateImageAtIndex(CGImageSourceCreateWithURL(URL(fileURLWithPath: args[1]) as CFURL, nil)!, 0, nil)!
let W = source.width, H = source.height
let space = CGColorSpace(name: CGColorSpace.sRGB)!
var pixels = [UInt8](repeating: 0, count: W * H * 4)
CGContext(data: &pixels, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: space,
          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    .draw(source, in: CGRect(x: 0, y: 0, width: W, height: H))

typealias RGB = (Double, Double, Double)
func get(_ x: Int, _ y: Int) -> RGB {
    let i = (y * W + x) * 4
    return (Double(pixels[i]), Double(pixels[i + 1]), Double(pixels[i + 2]))
}
func set(_ x: Int, _ y: Int, _ c: RGB) {
    let i = (y * W + x) * 4
    pixels[i] = UInt8(max(0, min(255, c.0.rounded())))
    pixels[i + 1] = UInt8(max(0, min(255, c.1.rounded())))
    pixels[i + 2] = UInt8(max(0, min(255, c.2.rounded())))
}
func mix(_ a: RGB, _ b: RGB, _ t: Double) -> RGB { (a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t, a.2 + (b.2 - a.2) * t) }
func mean(_ cs: [RGB]) -> RGB {
    let n = Double(cs.count)
    return (cs.map(\.0).reduce(0, +) / n, cs.map(\.1).reduce(0, +) / n, cs.map(\.2).reduce(0, +) / n)
}
/// A percentile of a row's pixels over a run of columns, by luminance: thin pattern lines drop out.
func percentile(_ y: Int, _ xs: ClosedRange<Int>, _ p: Double) -> RGB {
    let cs = xs.map { get($0, y) }.sorted { ($0.0 + $0.1 + $0.2) < ($1.0 + $1.1 + $1.2) }
    let k = max(2, min(cs.count - 3, Int(Double(cs.count - 1) * p)))
    return mean(Array(cs[(k - 2)...(k + 2)]))
}
/// A column of colours averaged over `radius` rows each way.
func smooth(_ column: [RGB], _ radius: Int) -> [RGB] {
    column.indices.map { i in mean(Array(column[max(0, i - radius)...min(column.count - 1, i + radius)])) }
}

/// Paints out the digits: inside the circle every pixel is a blend, by its distance from the centre, of the ring
/// just outside the circle in its direction and the ring's average colour at the centre.
func paintOut(cx: Int, cy: Double, radius: Double) {
    let steps = 720
    let ring: [RGB] = (0..<steps).map { k in
        let a = Double(k) / Double(steps) * 2 * .pi
        return mean((2...5).map { d in
            let r = radius + Double(d)
            return get(Int((Double(cx) + r * cos(a)).rounded()), Int((cy + r * sin(a)).rounded()))
        })
    }
    let centre = mean(ring)
    for y in Int(cy - radius)...Int(cy + radius) {
        for x in Int(Double(cx) - radius)...Int(Double(cx) + radius) {
            let dx = Double(x - cx), dy = Double(y) - cy
            let r = (dx * dx + dy * dy).squareRoot()
            guard r <= radius else { continue }
            var a = atan2(dy, dx)
            if a < 0 { a += 2 * .pi }
            let edge = ring[Int(a / (2 * .pi) * Double(steps)) % steps]
            let t = r / radius
            set(x, y, mix(centre, edge, t * t))
        }
    }
}

func write(_ name: String, x: Int, width: Int, top: Int, height: Int, to assets: String, mirroredFrom: [UInt8]? = nil) {
    var out = [UInt8](repeating: 255, count: width * height * 4)
    for row in 0..<height {
        for col in 0..<width {
            let s = ((top + row) * W + (x + col)) * 4, d = (row * width + col) * 4
            out[d] = pixels[s]; out[d + 1] = pixels[s + 1]; out[d + 2] = pixels[s + 2]; out[d + 3] = 255
        }
    }
    let ctx = CGContext(data: &out, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                        space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    let image = ctx.makeImage()!
    let dir = "\(assets)/\(name).imageset"
    try! FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
    let url = URL(fileURLWithPath: "\(dir)/\(name).jpg")
    let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: 0.92] as CFDictionary)
    CGImageDestinationFinalize(dest)
    let contents = """
    {
      "images" : [ { "filename" : "\(name).jpg", "idiom" : "universal" } ],
      "info" : { "author" : "xcode", "version" : 1 }
    }

    """
    try! contents.write(toFile: "\(dir)/Contents.json", atomically: true, encoding: .utf8)
}

for banner in banners {
    let height = banner.bottom - banner.top + 1
    let cy = Double(banner.top + banner.bottom) / 2
    let rightEdgeMirror = left + right            // x ↦ left + right − x mirrors the banner
    let rightMedallion = rightEdgeMirror - banner.medallionX
    let rightWingStart = rightEdgeMirror - banner.wingEnd

    paintOut(cx: banner.medallionX, cy: cy, radius: banner.paintRadius)
    paintOut(cx: rightMedallion, cy: cy, radius: banner.paintRadius)

    // The centre strip: per row, the median just inside each wing, blended left to right.
    let sample = banner.sample ?? banner.wingEnd...(banner.wingEnd + window)
    let mirrored = (rightEdgeMirror - sample.upperBound)...(rightEdgeMirror - sample.lowerBound)
    let leftColumn = smooth((banner.top...banner.bottom).map { percentile($0, sample, banner.percentile) }, banner.smoothing)
    let rightColumn = smooth((banner.top...banner.bottom).map { percentile($0, mirrored, banner.percentile) }, banner.smoothing)

    // Feather the wings' inner edges into those columns, so a pattern line never stops at a hard edge.
    for (i, y) in (banner.top...banner.bottom).enumerated() {
        let feather = banner.feather
        for k in 0..<feather {
            let t = Double(k + 1) / Double(feather)
            let xl = banner.wingEnd - feather + k + 1
            set(xl, y, mix(get(xl, y), leftColumn[i], t * t))
            let xr = rightWingStart + feather - k - 1
            set(xr, y, mix(get(xr, y), rightColumn[i], t * t))
        }
    }

    // Write the centre strip into a spare area of the buffer (the reference's empty margin) and cut it from there.
    let stripWidth = 64
    for (i, y) in (banner.top...banner.bottom).enumerated() {
        for k in 0..<stripWidth { set(k, y, mix(leftColumn[i], rightColumn[i], Double(k) / Double(stripWidth - 1))) }
    }

    let assets = args[2]
    write("SurahBanner\(banner.index)Left", x: left, width: banner.wingEnd - left + 1, top: banner.top, height: height, to: assets)
    write("SurahBanner\(banner.index)Right", x: rightWingStart, width: right - rightWingStart + 1, top: banner.top, height: height, to: assets)
    write("SurahBanner\(banner.index)Middle", x: 0, width: stripWidth, top: banner.top, height: height, to: assets)
    print("banner \(banner.index): height \(height), wing \(banner.wingEnd - left + 1), medallion at \(banner.medallionX - left) px")
}
