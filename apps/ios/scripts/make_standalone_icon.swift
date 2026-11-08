// Draws the standalone app's icon: an eight-pointed star (rub al-hizb) in gold on deep green, with «ق» in the
// middle. 1024 × 1024, opaque (App Store icons may not have an alpha channel).
// Usage: swift scripts/make_standalone_icon.swift <font.otf> <out.png>
import AppKit
import CoreText

let args = CommandLine.arguments
guard args.count == 3 else { print("usage: make_standalone_icon.swift font.otf out.png"); exit(2) }
let fontURL = URL(fileURLWithPath: args[1]) as CFURL
CTFontManagerRegisterFontsForURL(fontURL, .process, nil)

let size = 1024
let space = CGColorSpaceCreateDeviceRGB()
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: space,
                    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
let s = CGFloat(size)
func rgb(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat) -> CGColor { CGColor(red: r / 255, green: g / 255, blue: b / 255, alpha: 1) }

// Background: a radial green, lighter at the centre.
let bg = CGGradient(colorsSpace: space, colors: [rgb(22, 92, 74), rgb(8, 48, 40)] as CFArray, locations: [0, 1])!
ctx.drawRadialGradient(bg, startCenter: CGPoint(x: s / 2, y: s / 2), startRadius: 0,
                       endCenter: CGPoint(x: s / 2, y: s / 2), endRadius: s * 0.72, options: [.drawsAfterEndLocation])

let gold = rgb(222, 184, 104)
let centre = CGPoint(x: s / 2, y: s / 2)

// Two overlapping squares make the eight-pointed star.
func square(_ radius: CGFloat, rotation: CGFloat) -> CGPath {
    let p = CGMutablePath()
    for i in 0..<4 {
        let a = rotation + CGFloat(i) * .pi / 2 + .pi / 4
        let pt = CGPoint(x: centre.x + radius * cos(a), y: centre.y + radius * sin(a))
        i == 0 ? p.move(to: pt) : p.addLine(to: pt)
    }
    p.closeSubpath()
    return p
}
ctx.setStrokeColor(gold)
ctx.setLineJoin(.miter)
ctx.setLineWidth(26)
ctx.addPath(square(330, rotation: 0)); ctx.strokePath()
ctx.addPath(square(330, rotation: .pi / 4)); ctx.strokePath()
ctx.setLineWidth(10)
ctx.strokeEllipse(in: CGRect(x: centre.x - 205, y: centre.y - 205, width: 410, height: 410))

// The letter.
let font = CTFontCreateWithName("KFGQPCUthmanicScriptHAFS" as CFString, 300, nil)
let attr = NSAttributedString(string: "ق", attributes: [
    NSAttributedString.Key(kCTFontAttributeName as String): font,
    NSAttributedString.Key(kCTForegroundColorAttributeName as String): gold,
])
let line = CTLineCreateWithAttributedString(attr)
let bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)
ctx.textPosition = CGPoint(x: centre.x - bounds.midX, y: centre.y - bounds.midY)
CTLineDraw(line, ctx)

let image = ctx.makeImage()!
let rep = NSBitmapImageRep(cgImage: image)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[2]))
print("wrote \(args[2])")
