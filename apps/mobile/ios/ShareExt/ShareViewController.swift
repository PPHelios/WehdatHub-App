import UIKit
import UniformTypeIdentifiers

/// The iPhone Share sheet entry: takes the photos, voice notes and text shared from WhatsApp (or any app), saves them in the
/// App Group folder the app reads, and opens the app. Nothing is sent anywhere from here.
class ShareViewController: UIViewController {
  private let groupId = "group.com.wehdathub"
  private var files: [[String: String]] = []
  private var text: String?

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground
    let spinner = UIActivityIndicatorView(style: .large)
    spinner.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(spinner)
    NSLayoutConstraint.activate([spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor), spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor)])
    spinner.startAnimating()
    collect()
  }

  private func folder() -> URL? {
    guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupId) else { return nil }
    let dir = base.appendingPathComponent("shared", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }

  private func collect() {
    guard let dir = folder() else { return finish() }
    // A new share replaces the old one.
    (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil))?.forEach { try? FileManager.default.removeItem(at: $0) }
    let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
    let group = DispatchGroup()
    let lock = NSLock()
    for (i, p) in providers.prefix(15).enumerated() {
      let types: [(String, String)] = [(UTType.image.identifier, "image/jpeg"), (UTType.audio.identifier, "audio/mp4"), (UTType.fileURL.identifier, "application/octet-stream"), (UTType.plainText.identifier, "text/plain")]
      guard let match = types.first(where: { p.hasItemConformingToTypeIdentifier($0.0) }) else { continue }
      group.enter()
      p.loadItem(forTypeIdentifier: match.0, options: nil) { item, _ in
        defer { group.leave() }
        if match.1 == "text/plain" {
          if let s = item as? String { lock.lock(); self.text = ((self.text ?? "") + "\n" + s).trimmingCharacters(in: .whitespacesAndNewlines); lock.unlock() }
          return
        }
        var data: Data?
        var name = "shared_\(i)"
        var mime = match.1
        if let url = item as? URL {
          data = try? Data(contentsOf: url)
          name = url.lastPathComponent
          let ext = url.pathExtension.lowercased()
          if let t = UTType(filenameExtension: ext), let m = t.preferredMIMEType { mime = m }
          if ext == "opus" || ext == "ogg" { mime = "audio/ogg" }
        } else if let img = item as? UIImage {
          data = img.jpegData(compressionQuality: 0.85)
          name = "shared_\(i).jpg"
        } else if let d = item as? Data {
          data = d
        }
        guard let bytes = data else { return }
        let target = dir.appendingPathComponent("\(i)_\(name.replacingOccurrences(of: "/", with: "_"))")
        do {
          try bytes.write(to: target)
          lock.lock(); self.files.append(["path": target.path, "mimeType": mime, "name": name]); lock.unlock()
        } catch {}
      }
    }
    group.notify(queue: .main) { self.save(dir) }
  }

  private func save(_ dir: URL) {
    var payload: [String: Any] = ["files": files]
    if let t = text { payload["text"] = t }
    if let json = try? JSONSerialization.data(withJSONObject: payload) {
      try? json.write(to: dir.appendingPathComponent("pending.json"))
    }
    finish(open: true)
  }

  /// Opens the app through its own link (an extension has no direct way to), then closes the sheet.
  private func finish(open: Bool = false) {
    if open, let url = URL(string: "wehdathub://share") {
      var responder: UIResponder? = self
      let selector = NSSelectorFromString("openURL:")
      while let r = responder {
        if r.responds(to: selector), !(r is UIViewController) { _ = r.perform(selector, with: url); break }
        responder = r.next
      }
    }
    extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
  }
}
