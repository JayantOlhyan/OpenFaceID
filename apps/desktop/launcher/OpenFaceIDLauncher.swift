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

    var statusItem: NSStatusItem?
    var statusMenuItem: NSMenuItem?
    var cameraMenuItem: NSMenuItem?
    var pauseResumeMenuItem: NSMenuItem?
    var pollTimer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // 1. Configure Native Menu Bar
        setupMainMenu()
        setupStatusBarItem()

        // 2. Locate Bundled Resources
        var resUrl: URL? = Bundle.main.resourceURL
        if resUrl == nil || !FileManager.default.fileExists(atPath: resUrl!.path) {
            let exeUrl = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
            let bundleUrl = exeUrl.deletingLastPathComponent().deletingLastPathComponent() // MacOS -> Contents
            let candidate = bundleUrl.appendingPathComponent("Resources")
            if FileManager.default.fileExists(atPath: candidate.path) {
                resUrl = candidate
            }
        }
        let resourcesUrl = resUrl ?? URL(fileURLWithPath: "/Applications/OpenFaceID.app/Contents/Resources")
        let bundledNode = resourcesUrl.appendingPathComponent("bin/node").path
        let fallbackNode = "/opt/homebrew/bin/node"
        let nodePath = FileManager.default.fileExists(atPath: bundledNode) ? bundledNode :
                       FileManager.default.fileExists(atPath: fallbackNode) ? fallbackNode : "/usr/local/bin/node"

        let appDir = resourcesUrl.appendingPathComponent("app")
        let serveScript = appDir.appendingPathComponent("apps/desktop/serve.js").path
        let indexHtml = appDir.appendingPathComponent("apps/desktop/index.html").path
        let cameraBin = resourcesUrl.appendingPathComponent("bin/openfaceid-camera-avf").path

        if !FileManager.default.fileExists(atPath: indexHtml) {
            NSLog("[OpenFaceID] Warning: index.html not found at %@", indexHtml)
        }

        // 3. Launch Bundled Background Daemon Process
        if FileManager.default.fileExists(atPath: serveScript) {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: nodePath)
            process.currentDirectoryURL = appDir
            process.arguments = ["--experimental-strip-types", serveScript]

            var env = ProcessInfo.processInfo.environment
            env["NODE_ENV"] = "production"
            env["OFID_DESKTOP_STANDALONE"] = "true"
            env["OFID_RESOURCES_DIR"] = resourcesUrl.path
            env["OFID_APP_DIR"] = appDir.path
            env["OFID_CAMERA_BIN"] = cameraBin
            env["PATH"] = "\(resourcesUrl.appendingPathComponent("bin").path):/usr/bin:/bin:/usr/sbin:/sbin"
            process.environment = env

            let stdinPipe = Pipe()
            process.standardInput = stdinPipe

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
        let rect = NSRect(x: 0, y: 0, width: 1140, height: 780)
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.minSize = NSSize(width: 980, height: 680)
        window.title = "OpenFaceID"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.backgroundColor = NSColor(red: 12.0/255.0, green: 14.0/255.0, blue: 18.0/255.0, alpha: 1.0)
        window.isReleasedWhenClosed = false
        window.delegate = self

        // 5. Create WebKit View
        let webConfig = WKWebViewConfiguration()
        webView = WKWebView(frame: window.contentView!.bounds, configuration: webConfig)
        webView.autoresizingMask = [.width, .height]
        window.contentView!.addSubview(webView)

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        // 6. Connect to Local Daemon & Start Status Polling
        connectToLocalDaemon()
        startStatusPolling()
    }

    func setupStatusBarItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem?.button {
            button.title = "⚲ OpenFaceID"
            button.toolTip = "OpenFaceID — Facial Presence Detection"
        }

        let menu = NSMenu()

        let titleItem = NSMenuItem(title: "OpenFaceID", action: nil, keyEquivalent: "")
        titleItem.isEnabled = false
        menu.addItem(titleItem)

        statusMenuItem = NSMenuItem(title: "Status: ● Looking for you…", action: nil, keyEquivalent: "")
        statusMenuItem?.isEnabled = false
        menu.addItem(statusMenuItem!)

        cameraMenuItem = NSMenuItem(title: "Camera: ● Active", action: nil, keyEquivalent: "")
        cameraMenuItem?.isEnabled = false
        menu.addItem(cameraMenuItem!)

        let recItem = NSMenuItem(title: "Recognition: Ready", action: nil, keyEquivalent: "")
        recItem.isEnabled = false
        menu.addItem(recItem)

        let privItem = NSMenuItem(title: "Privacy: Active", action: nil, keyEquivalent: "")
        privItem.isEnabled = false
        menu.addItem(privItem)

        menu.addItem(NSMenuItem.separator())

        pauseResumeMenuItem = NSMenuItem(title: "Pause Camera", action: #selector(togglePrivacyPause), keyEquivalent: "p")
        menu.addItem(pauseResumeMenuItem!)

        let openItem = NSMenuItem(title: "Open Dashboard", action: #selector(showMainWindow), keyEquivalent: "o")
        menu.addItem(openItem)

        let settingsItem = NSMenuItem(title: "Settings…", action: #selector(openSettingsTab), keyEquivalent: ",")
        menu.addItem(settingsItem)

        let privCenterItem = NSMenuItem(title: "Privacy…", action: #selector(openPrivacyTab), keyEquivalent: "")
        menu.addItem(privCenterItem)

        let diagItem = NSMenuItem(title: "Diagnostics…", action: #selector(openDiagnosticsTab), keyEquivalent: "d")
        menu.addItem(diagItem)

        let updateItem = NSMenuItem(title: "Check for Updates…", action: #selector(checkForUpdates), keyEquivalent: "u")
        menu.addItem(updateItem)

        menu.addItem(NSMenuItem.separator())

        let quitItem = NSMenuItem(title: "Quit OpenFaceID", action: #selector(terminateApp), keyEquivalent: "q")
        menu.addItem(quitItem)

        statusItem?.menu = menu
    }

    @objc func showMainWindow() {
        if window != nil {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    @objc func openSettingsTab() {
        showMainWindow()
        webView?.evaluateJavaScript("switchTab('settings')", completionHandler: nil)
    }

    @objc func openPrivacyTab() {
        showMainWindow()
        webView?.evaluateJavaScript("switchTab('privacy')", completionHandler: nil)
    }

    @objc func openDiagnosticsTab() {
        showMainWindow()
        webView?.evaluateJavaScript("switchTab('diagnostics')", completionHandler: nil)
    }

    @objc func togglePrivacyPause() {
        webView?.evaluateJavaScript("togglePrivacyPause()", completionHandler: nil)
    }

    @objc func checkForUpdates() {
        if let url = URL(string: "https://github.com/JayantOlhyan/OpenFaceID/releases") {
            NSWorkspace.shared.open(url)
        }
    }

    @objc func terminateApp() {
        NSApplication.shared.terminate(nil)
    }

    func startStatusPolling() {
        pollTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            self?.pollStatus()
        }
    }

    func pollStatus() {
        let statusUrl = URL(string: "http://127.0.0.1:41793/api/v1/status")!
        var request = URLRequest(url: statusUrl)
        request.timeoutInterval = 1.0
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, _, error in
            guard let self = self, let data = data, error == nil else { return }
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let presence = json["presence"] as? [String: Any],
                   let isAuth = presence["isAuthorized"] as? Bool,
                   let canonical = json["canonicalState"] as? [String: Any],
                   let security = json["security"] as? [String: Any],
                   let isPaused = security["privacyPaused"] as? Bool {
                    
                    let det = canonical["detection"] as? String ?? ""
                    let presenceState = canonical["presence"] as? String ?? ""
                    let activeId = canonical["activeIdentityName"] as? String

                    DispatchQueue.main.async {
                        if isPaused {
                            self.statusMenuItem?.title = "Status: ● Privacy paused"
                            self.cameraMenuItem?.title = "Camera: ● Paused"
                            self.pauseResumeMenuItem?.title = "Resume Camera"
                            if let button = self.statusItem?.button {
                                button.title = "⏸ OpenFaceID"
                            }
                        } else if isAuth {
                            let name = activeId != nil ? " • \(activeId!)" : ""
                            self.statusMenuItem?.title = "Status: ● You're present\(name)"
                            self.cameraMenuItem?.title = "Camera: ● Active"
                            self.pauseResumeMenuItem?.title = "Pause Camera"
                            if let button = self.statusItem?.button {
                                button.title = "✓ OpenFaceID"
                            }
                        } else if presenceState == "PRESENCE_AMBIGUOUS" {
                            self.statusMenuItem?.title = "Status: ● Multiple people detected"
                            self.cameraMenuItem?.title = "Camera: ● Active"
                            if let button = self.statusItem?.button {
                                button.title = "⚠ OpenFaceID"
                            }
                        } else if det == "FACE_DETECTED" {
                            self.statusMenuItem?.title = "Status: ● Checking identity…"
                            self.cameraMenuItem?.title = "Camera: ● Active"
                            if let button = self.statusItem?.button {
                                button.title = "⚲ OpenFaceID"
                            }
                        } else {
                            self.statusMenuItem?.title = "Status: ● Looking for you…"
                            self.cameraMenuItem?.title = "Camera: ● Active"
                            if let button = self.statusItem?.button {
                                button.title = "⚲ OpenFaceID"
                            }
                        }
                    }
                }
            } catch {}
        }
        task.resume()
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
        // Keep running in menu bar when main window is closed
        return false
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            showMainWindow()
        }
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        pollTimer?.invalidate()
        pollTimer = nil
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
