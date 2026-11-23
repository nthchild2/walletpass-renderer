// PassKit layout probe (iOS Simulator app). Draws every unpacked pass in the app bundle's passes/
// folder with PassKit's own PKPassView and writes, per pass, the frame and font of every UILabel
// (labels, values, logo text), the row templates, and a PNG render, to tmp/out/ in the app's container.
//
// Wallet's Add Pass sheet refuses passes whose signature doesn't verify, so this loads them with
// the private +[PKPass createWithValidatedFileDataAccessor:], which skips that check. Simulator
// and development use only. Built and run by run.mjs.
import ObjectiveC
import PassKit
import UIKit

private func makePassView(_ url: URL) -> UIView? {
  guard let accessorClass = NSClassFromString("PKFileDataAccessor") as? NSObject.Type,
        let viewClass = NSClassFromString("PKPassView") as? UIView.Type else { return nil }
  typealias InitURL = @convention(c) (AnyObject, Selector, NSURL, UnsafeMutablePointer<NSError?>?) -> AnyObject?
  let initSel = NSSelectorFromString("initWithFileURL:error:")
  let initURL = unsafeBitCast(class_getMethodImplementation(accessorClass, initSel), to: InitURL.self)
  var error: NSError?
  guard let accessor = initURL(accessorClass.perform(NSSelectorFromString("alloc")).takeUnretainedValue(), initSel, url as NSURL, &error),
        let pass = (PKPass.self as AnyObject).perform(NSSelectorFromString("createWithValidatedFileDataAccessor:"), with: accessor)?.takeUnretainedValue()
  else {
    NSLog("PROBE: could not load %@ (%@)", url.lastPathComponent, String(describing: error))
    return nil
  }
  typealias InitView = @convention(c) (AnyObject, Selector, AnyObject, Int) -> UIView
  let viewSel = NSSelectorFromString("initWithPass:content:")
  let initView = unsafeBitCast(class_getMethodImplementation(viewClass, viewSel), to: InitView.self)
  return initView(viewClass.perform(NSSelectorFromString("alloc")).takeUnretainedValue(), viewSel, pass, 5)
}

private func round3(_ v: CGFloat) -> Double { (Double(v) * 100).rounded() / 100 }

private func templateInfo(_ bucket: AnyObject) -> [String: Any] {
  var info: [String: Any] = [:]
  if let rect = (bucket.value(forKey: "bucketRect") as? NSValue)?.cgRectValue {
    info["rect"] = [rect.minX, rect.minY, rect.width, rect.height].map(round3)
  }
  for key in ["maxFields", "minFieldPadding", "bucketAlignment", "verticalAlignment"] { info[key] = bucket.value(forKey: key) }
  if let field = bucket.value(forKey: "defaultFieldTemplate") as AnyObject? {
    for key in ["valueFont", "labelFont"] {
      if let font = field.value(forKey: key) as? UIFont { info[key] = "\(font.fontName) \(font.pointSize)" }
    }
    let flags = ["boxedValueCanWrap": "valueCanWrap", "boxedValuePrefersSingleLine": "valuePrefersSingleLine", "boxedVerticalPadding": "verticalPadding", "boxedSuppressesLabel": "suppressesLabel"]
    for (key, name) in flags { if let v = field.value(forKey: key) { info[name] = v } }
  }
  return info
}

final class ProbeViewController: UIViewController {
  private var passViews: [(name: String, view: UIView)] = []

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .white
    dlopen("/System/Library/PrivateFrameworks/PassKitUI.framework/PassKitUI", RTLD_NOW)
    let dir = Bundle.main.bundleURL.appendingPathComponent("passes")
    let names = ((try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? []).filter { $0.hasSuffix(".pass") }.sorted()
    let width = view.bounds.width - 32
    for name in names {
      guard let pv = makePassView(dir.appendingPathComponent(name)) else { continue }
      view.addSubview(pv)
      let size = pv.sizeThatFits(CGSize(width: width, height: 10000))
      pv.frame = CGRect(x: 16, y: 100, width: size.width, height: size.height)
      passViews.append((String(name.dropLast(5)), pv))
    }
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self.dump() }
  }

  private func dump() {
    let out = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("out")
    try? FileManager.default.removeItem(at: out)
    try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
    for (name, pv) in passViews {
      for other in passViews { other.view.isHidden = other.view !== pv }
      pv.layoutIfNeeded()
      var frames: [[String: Any]] = []
      var buckets: [[String: Any]] = []
      var views: [[String: Any]] = []
      func walk(_ v: UIView, inBarcode: Bool = false) {
        if v.isHidden || v.alpha == 0 { return }
        let cls = NSStringFromClass(type(of: v))
        let barcode = inBarcode || cls.contains("Barcode")
        // Barcode views and the images inside them (the sticker box, the code image).
        if cls.contains("Barcode") || (inBarcode && v is UIImageView) {
          let f = v.convert(v.bounds, to: pv)
          views.append(["class": cls, "frame": [f.minX, f.minY, f.width, f.height].map(round3)])
        }
        if NSStringFromClass(type(of: v)) == "PKPassBucketView", let t = v.value(forKey: "bucketTemplate") as AnyObject? {
          buckets.append(templateInfo(t))
        }
        if let label = v as? UILabel, let text = label.text {
          let f = label.convert(label.bounds, to: pv)
          frames.append([
            "text": text,
            "frame": [f.minX, f.minY, f.width, f.height].map(round3),
            "size": round3(label.font.pointSize),
            "font": label.font.fontName,
            "lines": label.numberOfLines,
          ])
        }
        v.subviews.forEach { walk($0, inBarcode: barcode) }
      }
      walk(pv)
      let result: [String: Any] = ["width": round3(pv.bounds.width), "frames": frames, "buckets": buckets, "views": views]
      if let data = try? JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]) {
        try? data.write(to: out.appendingPathComponent(name + ".json"))
      }
      let image = UIGraphicsImageRenderer(bounds: pv.bounds).image { _ in pv.drawHierarchy(in: pv.bounds, afterScreenUpdates: true) }
      try? image.pngData()?.write(to: out.appendingPathComponent(name + ".png"))
    }
    try? "done".write(to: out.appendingPathComponent("DONE"), atomically: true, encoding: .utf8)
    NSLog("PROBE: done %d", passViews.count)
  }
}

@main
final class ProbeApp: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    window = UIWindow(frame: UIScreen.main.bounds)
    window?.rootViewController = ProbeViewController()
    window?.makeKeyAndVisible()
    return true
  }
}
