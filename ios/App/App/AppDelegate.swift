import UIKit
import Security
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// App-local plugin: refresh tokens never enter Preferences/localStorage or device backups.
@objc(DaegukSessionPlugin)
public class DaegukSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DaegukSessionPlugin"
    public let jsName = "DaegukSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestCaptcha", returnType: CAPPluginReturnPromise)
    ]
    private var captchaController: DaegukCaptchaViewController?
    @objc func requestCaptcha(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, self.permitted(call) else { return }
            guard self.captchaController == nil,
                  let presenter = self.bridge?.viewController,
                  presenter.presentedViewController == nil else {
                call.reject("CAPTCHA already open"); return
            }
            let controller = DaegukCaptchaViewController(language: call.getString("language") == "ko" ? "ko" : "en")
            self.captchaController = controller
            self.bridge?.saveCall(call)
            controller.completion = { [weak self] token in
                if let self = self, self.permitted(call) {
                    if let token = token { call.resolve(["token": token]) }
                    else { call.reject("CAPTCHA unavailable or cancelled") }
                }
                self?.bridge?.releaseCall(call)
                self?.captchaController = nil
            }
            let navigation = UINavigationController(rootViewController: controller)
            navigation.modalPresentationStyle = .fullScreen
            presenter.present(navigation, animated: true)
        }
    }
    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "com.boahspark.daeguk.auth",
         kSecAttrAccount as String: "supabase-refresh-ajmrlhfhrcsstauqgnip"]
    }
    private func permitted(_ call: CAPPluginCall) -> Bool {
        guard let url = bridge?.webView?.url, url.scheme == "capacitor", url.host == "localhost" else {
            call.reject("Session access denied")
            return false
        }
        return true
    }
    @objc func get(_ call: CAPPluginCall) {
        guard permitted(call) else { return }
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &result)
        if status == errSecItemNotFound { call.resolve(["value": NSNull()]); return }
        guard status == errSecSuccess, let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            call.reject("Secure session unavailable"); return
        }
        call.resolve(["value": value])
    }
    @objc func set(_ call: CAPPluginCall) {
        guard permitted(call) else { return }
        guard let value = call.getString("value"), !value.isEmpty, value.utf8.count <= 4096 else {
            call.reject("Invalid session"); return
        }
        let attributes: [String: Any] = [
            kSecValueData as String: Data(value.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            status = SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil)
        }
        guard status == errSecSuccess else { call.reject("Unable to save secure session"); return }
        call.resolve()
    }
    @objc func clear(_ call: CAPPluginCall) {
        guard permitted(call) else { return }
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            call.reject("Unable to clear secure session"); return
        }
        call.resolve()
    }
}

// A separate HTTPS WebView receives only a CAPTCHA result. It has no session-storage bridge.
private final class DaegukCaptchaViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate {
    private static let host = "unknown-kingdom.vercel.app"
    private static let path = "/js/native-captcha.html"
    private let language: String
    private var webView: WKWebView!
    private var timeout: Timer?
    private var finished = false
    var completion: ((String?) -> Void)?

    init(language: String) { self.language = language; super.init(nibName: nil, bundle: nil) }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = language == "ko" ? "온라인 대국 시작" : "Start online play"
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            title: language == "ko" ? "취소" : "Cancel", style: .plain, target: self, action: #selector(cancel))
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(self, name: "daegukCaptcha")
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        view = webView
        // Keep WebKit's default user agent and TLS handling. Never override security challenges.
        let url = URL(string: "https://\(Self.host)\(Self.path)?lang=\(language)")!
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
        timeout = Timer.scheduledTimer(withTimeInterval: 180, repeats: false) { [weak self] _ in self?.finish(nil) }
    }

    @objc private func cancel() { finish(nil) }
    private func finish(_ token: String?) {
        guard !finished else { return }
        finished = true
        timeout?.invalidate()
        timeout = nil
        webView.stopLoading()
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "daegukCaptcha")
        let callback = completion
        completion = nil
        dismiss(animated: true) { callback?(token) }
    }

    private func isVerificationPage(_ url: URL?) -> Bool {
        guard let url = url else { return false }
        return url.scheme == "https" && url.host == Self.host && url.path == Self.path
            && (url.port == nil || url.port == 443) && url.user == nil && url.password == nil
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
        guard message.name == "daegukCaptcha", message.frameInfo.isMainFrame,
              origin.protocol == "https", origin.host == Self.host,
              (origin.port == 0 || origin.port == 443),
              isVerificationPage(message.frameInfo.request.url), isVerificationPage(webView.url),
              let body = message.body as? [String: Any] else { return }
        if let token = body["token"] as? String, !token.isEmpty, token.utf8.count <= 4096 { finish(token) }
        else { finish(nil) }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let frame = navigationAction.targetFrame else { decisionHandler(.cancel); return }
        if frame.isMainFrame {
            let allowed = isVerificationPage(navigationAction.request.url)
            decisionHandler(allowed ? .allow : .cancel)
            if !allowed { finish(nil) }
        } else {
            let url = navigationAction.request.url
            let allowed = (url?.scheme == "https" && url?.host == "challenges.cloudflare.com")
                || url?.absoluteString == "about:blank" || url?.absoluteString == "about:srcdoc"
            decisionHandler(allowed ? .allow : .cancel)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if navigationResponse.isForMainFrame,
           let response = navigationResponse.response as? HTTPURLResponse,
           response.statusCode != 200 {
            decisionHandler(.cancel); finish(nil); return
        }
        decisionHandler(.allow)
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { finish(nil) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { finish(nil) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { finish(nil) }
}

@objc(DaegukBridgeViewController)
class DaegukBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(DaegukSessionPlugin())
    }
}
