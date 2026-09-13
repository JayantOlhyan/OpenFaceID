import Cocoa
import WebKit

/**
 * OpenFaceID Native macOS Desktop Application Launcher
 * Embeds WKWebView, supervises bundled Node daemon, provides native menu & Dock presence.
 * Zero terminal window. Self-contained Mac application experience.
 */

class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var daemonProcess: Process?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // 1. Configure Native Menu Bar
        setupMainMenu()

        // 2. Locate Bundled Resources
        let resourcesUrl = Bundle.main.resourceURL ?? URL(fileURLWithPath: "/Applications/OpenFaceID.app/Contents/Resources")
        let bundledNode = resourcesUrl.appendingPathComponent("bin/node").path
        let fallbackNode = "/opt/homebrew/bin/node"
        let nodePath = FileManager.default.fileExists(atPath: bundledNode) ? bundledNode :
                       FileManager.default.fileExists(atPath: fallbackNode) ? fallbackNode : "/usr/local/bin/node"

        let appDir = resourcesUrl.appendingPathComponent("app")
        let serveScript = appDir.appendingPathComponent("apps/desktop/serve.js").path
        let cameraBin = resourcesUrl.appendingPathComponent("bin/openfaceid-camera-avf").path

        // 3. Launch Bundled Background Daemon Process
        if FileManager.default.fileExists(atPath: serveScript) {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: nodePath)
            process.currentDirectoryURL = appDir
            process.arguments = ["--experimental-strip-types", serveScript]

            var env = ProcessInfo.processInfo.environment
            env["NODE_ENV"] = "production"
            env["OFID_DESKTOP_STANDALONE"] = "true"
            env["OFID_CAMERA_BIN"] = cameraBin
            env["PATH"] = "\(resourcesUrl.appendingPathComponent("bin").path):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
            process.environment = env

            do {
                try process.run()
                self.daemonProcess = process
                NSLog("[OpenFaceID] Bundled daemon spawned (PID: %d)", process.processIdentifier)
            } catch {
                NSLog("[OpenFaceID] Failed to launch daemon: %@", error.localizedDescription)
            }
        } else {
            NSLog("[OpenFaceID] Warning: serve.js not found at %@", serveScript)
        }

        // 4. Create Native macOS Window
        let rect = NSRect(x: 0, y: 0, width: 1120, height: 800)
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = "OpenFaceID"
        window.titlebarAppearsTransparent = true
        window.isReleasedWhenClosed = false
        window.delegate = self

        // 5. Create WebKit View
        let webConfig = WKWebViewConfiguration()
        webView = WKWebView(frame: window.contentView!.bounds, configuration: webConfig)
        webView.autoresizingMask = [.width, .height]
        window.contentView!.addSubview(webView)

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        // 6. Connect to Local Daemon
        connectToLocalDaemon()
    }

    func connectToLocalDaemon() {
        let targetUrl = URL(string: "http://127.0.0.1:41793/")!
        let checkUrl = URL(string: "http://127.0.0.1:41793/api/v1/capabilities")!

        func probeAndLoad(retriesLeft: Int) {
            var request = URLRequest(url: checkUrl)
            request.timeoutInterval = 1.0
            let task = URLSession.shared.dataTask(with: request) { _, response, error in
                if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                    DispatchQueue.main.async {
                        self.webView.load(URLRequest(url: targetUrl))
                    }
                } else if retriesLeft > 0 {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        probeAndLoad(retriesLeft: retriesLeft - 1)
                    }
                } else {
                    DispatchQueue.main.async {
                        self.webView.load(URLRequest(url: targetUrl))
                    }
                }
            }
            task.resume()
        }

        probeAndLoad(retriesLeft: 25)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        if let process = daemonProcess, process.isRunning {
            process.terminate()
            NSLog("[OpenFaceID] Terminated daemon process")
        }
    }

    func setupMainMenu() {
        let mainMenu = NSMenu()

        // App Menu
        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About OpenFaceID", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Hide OpenFaceID", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthersItem = NSMenuItem(title: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthersItem.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(hideOthersItem)
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit OpenFaceID", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        // Edit Menu (Copy / Paste support in inputs)
        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        // Window Menu
        let windowMenuItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.miniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.zoom(_:)), keyEquivalent: "")
        windowMenuItem.submenu = windowMenu
        mainMenu.addItem(windowMenuItem)

        NSApp.mainMenu = mainMenu
    }
}

// Application Entrypoint
let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
