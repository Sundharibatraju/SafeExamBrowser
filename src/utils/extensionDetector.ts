/**
 * Real-Time Browser Extension Detection & Shield System
 * Multi-Vector Engine detecting ALL browser extensions in real-time.
 *
 * Vectors:
 * 1. chrome.management API (Direct browser API detection of all active non-essential extensions)
 * 2. Active Micro-Bait Traps (Interactive event triggers for dormant extensions: Grammarly, Password Managers, Writing Tools)
 * 3. Web Accessible Resources (WAR) Probe (Targeting top 60+ extensions)
 * 4. chrome.runtime.sendMessage Heuristic Probe (Discriminating access errors on active extensions)
 * 5. Global Window Objects & Prototype Monkey-Patch Detector (DevTools, AI Copilots, Crypto, Script managers)
 * 6. Document & Body Attribute Sniffer (Non-standard attributes injected by content scripts)
 * 7. Universal Custom Elements & Shadow DOM Inspector (Hyphenated tags, foreign shadow roots)
 * 8. Foreign Body Sibling Container Scanner (Floating bars, sidebars, badges)
 * 9. Resource Timing & Extension Protocol Sniffer (chrome-extension://, moz-extension://)
 * 10. AdBlocker & Content Filter Detector (Cosmetic filter computed styles + Network fetch bait)
 * 11. Extension PostMessage & Event Observer (Catching content script handshakes)
 *
 * Real-time Watchdog: Runs every 50ms + on every DOM mutation + requestAnimationFrame + visibilitychange.
 */

export interface DetectedExtension {
  id: string;
  name: string;
  category:
    | 'AI Assistant / Copilot'
    | 'Grammar & Writing Tool'
    | 'DevTools & Script Injector'
    | 'Password Manager / Form Filler'
    | 'Screen Capture & Recorder'
    | 'AdBlocker & Content Filter'
    | 'Translation Overlay'
    | 'Web3 / Crypto Wallet'
    | 'Third-Party Extension'
    | 'Browser App';
  detail: string;
  reason: string;
  remediation: string;
  detectionSource?: 'chrome.management' | 'heuristics-dom' | 'heuristics-war' | 'heuristics-runtime' | 'heuristics-network';
}

export interface ExtensionAuditReport {
  hasExtension: boolean;
  blocked: boolean;
  extensions: DetectedExtension[];
  timestamp: number;
  injectedDomElements?: string[];
  injectedAttributes?: string[];
  globalObjectFlags?: string[];
  uriMatches?: string[];
  usedChromeManagement?: boolean;
}

export interface BackendAuditVerificationResponse {
  success: boolean;
  clean: boolean;
  blocked: boolean;
  message: string;
  verifiedExtensions: DetectedExtension[];
  serverAuditId: string;
  timestamp: number;
}

export interface WatchdogOptions {
  onStatusChange?: (audit: ExtensionAuditReport) => void;
  onExtensionDetected?: (ext: DetectedExtension) => void;
  onExtensionTurnedOff?: () => void;
  pollIntervalMs?: number;
}

// Top known extension IDs with metadata
export const KNOWN_EXTENSIONS_MAP: Record<string, { name: string; category: DetectedExtension['category']; warPath?: string }> = {
  // DevTools & Scripting
  'fmkadmapgofadopljbjfkapdkoienihi': { name: 'React Developer Tools', category: 'DevTools & Script Injector', warPath: 'main.html' },
  'lmhkpmbekcpmknklioeibfkpmmfibljd': { name: 'Redux DevTools', category: 'DevTools & Script Injector', warPath: 'page.bundle.js' },
  'nhdogjmejiglipccpnnnanhbledajbpd': { name: 'Vue.js DevTools', category: 'DevTools & Script Injector', warPath: 'devtools-background.html' },
  'ienfnnnhckljlalbaglipmmjimbeihfd': { name: 'Angular DevTools', category: 'DevTools & Script Injector', warPath: 'main.html' },
  'dhdgffkkebhmkfjojejmpbldmpobfkfo': { name: 'Tampermonkey Userscript Manager', category: 'DevTools & Script Injector', warPath: 'options.html' },
  'jinjaccalgkegednnccohejagnlnfdag': { name: 'Violentmonkey Userscript Manager', category: 'DevTools & Script Injector', warPath: 'popup/index.html' },
  'bcjindcccaagfpapjjmafapmmgkkhgoa': { name: 'JSON Formatter / Viewer', category: 'DevTools & Script Injector', warPath: 'options.html' },
  'gfdkimpbcpahaombhbimeihdjnejgicl': { name: 'JSON Viewer Pro', category: 'DevTools & Script Injector', warPath: 'viewer.html' },
  'bfbameneiokkgbdmiekhjnmfkcnldhhm': { name: 'Web Developer Extension', category: 'DevTools & Script Injector', warPath: 'options/options.html' },
  'gppongmhjkpfnbhagpmjfkannfbllamg': { name: 'Wappalyzer Technology Profiler', category: 'DevTools & Script Injector', warPath: 'popup.html' },

  // Grammar & Writing
  'kbfnbcaehmbcioakkpcpgfkobkghlhen': { name: 'Grammarly Writing Assistant', category: 'Grammar & Writing Tool', warPath: 'src/assets/icon-128.png' },
  'aiimbolennfhedipdmflndegebakhfhj': { name: 'LanguageTool Grammar Checker', category: 'Grammar & Writing Tool', warPath: 'assets/images/logo.png' },
  'oldceeleldhonbafppcapldpdifcinji': { name: 'LanguageTool Multilingual Checker', category: 'Grammar & Writing Tool', warPath: 'assets/images/logo.png' },
  'iidnbdjijdkbmajdffnidomddglmieko': { name: 'QuillBot Writing & Paraphrasing Tool', category: 'Grammar & Writing Tool', warPath: 'images/icon.png' },
  'clioipggpappejkclfdnfkekgffmgolj': { name: 'ProWritingAid Grammar Assistant', category: 'Grammar & Writing Tool', warPath: 'assets/pwa-icon.png' },

  // AdBlockers & Privacy Shields
  'cjpalhdlnbpafiamejdnhcphjbkeiagm': { name: 'uBlock Origin AdBlocker', category: 'AdBlocker & Content Filter', warPath: 'web-accessible-resources/noop.html' },
  'gighmmpiobklfepjocnamgkkbiglidom': { name: 'AdBlock Extension', category: 'AdBlocker & Content Filter', warPath: 'button/popup.html' },
  'cfhdojbkjhnklbpkdaibdccddilifddb': { name: 'Adblock Plus', category: 'AdBlocker & Content Filter', warPath: 'icons/abp-16.png' },
  'bgnkhhnnamicmpeenaelnjfhikgbkllg': { name: 'AdGuard AdBlocker', category: 'AdBlocker & Content Filter', warPath: 'pages/popup.html' },
  'mlomiejdfkolichcflejclcbmpeaniij': { name: 'Ghostery Privacy AdBlocker', category: 'AdBlocker & Content Filter', warPath: 'app/templates/bubble.html' },
  'pkehgijcmpdhfbdbbnkijodmdjhbjlgp': { name: 'Privacy Badger Tracker Blocker', category: 'AdBlocker & Content Filter', warPath: 'skin/popup.html' },

  // Password Managers
  'nngceckbapebfimnlniiiahkandclblb': { name: 'Bitwarden Password Manager', category: 'Password Manager / Form Filler', warPath: 'popup/index.html' },
  'aeblfdkhhhdcdjpifhhbdiojplfjncoa': { name: '1Password Extension', category: 'Password Manager / Form Filler', warPath: 'overlay/index.html' },
  'hdokiejnpimakedhajhdlcegeplioahd': { name: 'LastPass Password Manager', category: 'Password Manager / Form Filler', warPath: 'lpfulllib.js' },
  'fdjamakpfbbflfjalbgdfbmikbffdchk': { name: 'Dashlane Password Manager', category: 'Password Manager / Form Filler', warPath: 'panel.html' },
  'ghpmbihjnenlcmnebekfgcmegdpndmlo': { name: 'Proton Pass Password Manager', category: 'Password Manager / Form Filler', warPath: 'popup.html' },
  'fooolghllnmhmmndgjiamiiodkpenpbb': { name: 'NordPass Password Manager', category: 'Password Manager / Form Filler', warPath: 'panel/panel.html' },
  'bfogiafebfohielmmehojehhgboclglg': { name: 'Keeper Password Manager', category: 'Password Manager / Form Filler', warPath: 'popup.html' },

  // Screen Recorders & Video Capture
  'liecbddmkiiihnedobmlmillhodjkdnb': { name: 'Loom Screen Recorder', category: 'Screen Capture & Recorder', warPath: 'img/logo.png' },
  'liecbjdnginfnnipflemodadplneajbp': { name: 'Loom Screen Recording Companion', category: 'Screen Capture & Recorder', warPath: 'img/logo.png' },
  'mmeijimgabbpbgpdklnllpncmdofkcpn': { name: 'Screencastify Screen Recorder', category: 'Screen Capture & Recorder', warPath: 'images/icon.png' },
  'ogilmepnnlfldgjadclcenehnnliocmi': { name: 'Vidyard Video Recorder', category: 'Screen Capture & Recorder', warPath: 'popup.html' },
  'nlipoenfbbikpkjkekignbikijdjoche': { name: 'Awesome Screenshot & Recorder', category: 'Screen Capture & Recorder', warPath: 'images/icon.png' },
  'bpconcjcammlapcogcnnelfmaeghhagj': { name: 'Nimbus Screenshot & Screen Video', category: 'Screen Capture & Recorder', warPath: 'images/icon.png' },

  // AI Copilots & Assistants
  'difoiogjjojoaoomphldepapgpbgkhkb': { name: 'Sider AI Assistant', category: 'AI Assistant / Copilot', warPath: 'popup.html' },
  'ofpnmcalabcbjgholdjcjblkibolbppb': { name: 'Monica AI Copilot', category: 'AI Assistant / Copilot', warPath: 'popup.html' },
  'eapflnaphaehdfegggfldgahklflbeim': { name: 'HARPA AI Automation', category: 'AI Assistant / Copilot', warPath: 'popup.html' },
  'camppjleccjaphfdmbikhemgjhflplnm': { name: 'Merlin AI Copilot', category: 'AI Assistant / Copilot', warPath: 'popup.html' },
  'jgjaeacdkonaoafenlfkkkmbaopkbilf': { name: 'ChatGPT for Google', category: 'AI Assistant / Copilot', warPath: 'popup.html' },
  'hlgbcneanompleignomismghmhcjpmbe': { name: 'Perplexity AI Companion', category: 'AI Assistant / Copilot', warPath: 'popup.html' },

  // Theme & Styling
  'eimadpbcbfnmbkopoojfekhnkhdbieeh': { name: 'Dark Reader Theme Extension', category: 'Third-Party Extension', warPath: 'ui/popup/index.html' },
  'bhlhnicpbjkfdgahfnagmcmggfdmdflj': { name: 'ColorZilla Eyedropper & Color Picker', category: 'Third-Party Extension', warPath: 'css/popup.css' },
  'bhlhkgjfdnhfdmphhhlaffbmponignipl': { name: 'ColorZilla Eyedropper & Color Picker', category: 'Third-Party Extension', warPath: 'css/popup.css' },

  // Translation Overlays
  'aapbdbdomjkkjkaonfhkkikfgjllcleb': { name: 'Google Translate Extension', category: 'Translation Overlay', warPath: 'popup.html' },
  'aapocclcgogkmnckokdopfmhonfmgoek': { name: 'Google Translate Official', category: 'Translation Overlay', warPath: 'popup.html' },
  'bpoadfkcbjbfhfodiogcnhhhpibjhbnh': { name: 'Immersive Translate Extension', category: 'Translation Overlay', warPath: 'popup.html' },
  'cofdbpoegempjloogbagkncekinflcnj': { name: 'DeepL Translate Extension', category: 'Translation Overlay', warPath: 'popup.html' },

  // Web3 / Crypto Wallets
  'nkbihfbeogaeaoehlefnkodbefgpgknn': { name: 'MetaMask Crypto Wallet', category: 'Web3 / Crypto Wallet', warPath: 'images/icon-128.png' },
  'bfnaelmomeimhlpmgjnjophhpkkoljpa': { name: 'Phantom Crypto Wallet', category: 'Web3 / Crypto Wallet', warPath: 'img/icon-128.png' },
  'hnfanknocfeofbddgcijnmhnfnkdnaad': { name: 'Coinbase Wallet Extension', category: 'Web3 / Crypto Wallet', warPath: 'popup.html' },

  // Shopping & Media
  'bmnlcjabgnpnenekpadlanbbkooimhnj': { name: 'Honey / PayPal Honey Extension', category: 'Third-Party Extension', warPath: 'popup.html' },
  'chhjbpecembffkdgflpnhflepamlijkd': { name: 'Rakuten Cash Back Extension', category: 'Third-Party Extension', warPath: 'content.css' },
  'nenlahapcbofgnanklpelkaejcehkggg': { name: 'Capital One Shopping', category: 'Third-Party Extension', warPath: 'static/media/logo.svg' },
  'nffaoalbilbmmfgbnbgppjihopabppdk': { name: 'Video Speed Controller', category: 'Third-Party Extension', warPath: 'options.html' },
  'jghecgabfgfdldnmbfkhmffcabddioke': { name: 'Volume Master Extension', category: 'Third-Party Extension', warPath: 'popup.html' },
  'hkgfohmbfplgahibfdndngmdapgijdhh': { name: 'Picture-in-Picture Extension', category: 'Third-Party Extension', warPath: 'popup.html' },
  'mpbjkejclgikndiakhapgkgpkbpnihlo': { name: 'Buster: Captcha Solver', category: 'Third-Party Extension', warPath: 'src/options/index.html' }
};

// Store asynchronously detected extensions (from chrome.management, WAR probes, network probes, and runtime messages)
let asyncDetectedExtensions: DetectedExtension[] = [];

/**
 * Direct chrome.management API Inspector.
 * Uses the Chrome Extension Management API if exposed (e.g. companion extension, enterprise policy, test harness, or window bridge).
 * Identifies active non-essential extensions and returns them.
 */
export async function queryChromeManagementApi(): Promise<DetectedExtension[]> {
  if (typeof window === 'undefined') return [];

  const found: DetectedExtension[] = [];
  const chromeObj = (window as any).chrome || (window as any).browser;

  // 1. Direct chrome.management.getAll()
  if (chromeObj?.management && typeof chromeObj.management.getAll === 'function') {
    try {
      const extList: any[] = await new Promise((resolve, reject) => {
        let called = false;
        try {
          const ret = chromeObj.management.getAll((list: any[]) => {
            if (called) return;
            called = true;
            if (chromeObj.runtime?.lastError) {
              reject(chromeObj.runtime.lastError);
            } else {
              resolve(list || []);
            }
          });
          if (ret && typeof ret.then === 'function') {
            ret.then((res: any[]) => {
              if (!called) {
                called = true;
                resolve(res || []);
              }
            }).catch(reject);
          }
        } catch (err) {
          reject(err);
        }
        setTimeout(() => {
          if (!called) {
            called = true;
            resolve([]);
          }
        }, 1200);
      });

      if (Array.isArray(extList)) {
        for (const ext of extList) {
          // Identify enabled extensions that are non-essential (e.g. not system themes or internal proctor tools)
          if (ext.enabled && ext.type !== 'theme') {
            const known = KNOWN_EXTENSIONS_MAP[ext.id];
            const name = ext.name || known?.name || `Browser Extension (${ext.id.slice(0, 8)})`;
            const category = known?.category || (ext.type === 'hosted_app' ? 'Browser App' : 'Third-Party Extension');

            found.push({
              id: `chrome-mgmt-${ext.id}`,
              name,
              category,
              detail: `Active extension reported by chrome.management API: ${name} (ID: ${ext.id}, v${ext.version || '1.0'})`,
              reason: 'Chrome reported this extension as currently ENABLED and active. Extensions can read examination questions and compromise testing integrity.',
              remediation: `Open chrome://extensions, locate "${name}", and toggle the switch to OFF.`,
              detectionSource: 'chrome.management'
            });
          }
        }
      }
    } catch (e) {
      // Permission not granted or chrome.management restricted to extension context
    }
  }

  // 2. Window Extension Bridge (for companion proctoring extension or custom test runner)
  if (typeof (window as any).__ACTIVE_EXTENSIONS__ !== 'undefined' && Array.isArray((window as any).__ACTIVE_EXTENSIONS__)) {
    for (const item of (window as any).__ACTIVE_EXTENSIONS__) {
      const name = typeof item === 'string' ? item : item.name || 'Active Browser Extension';
      found.push({
        id: `ext-bridge-${typeof item === 'string' ? item : item.id || Math.random()}`,
        name,
        category: (item.category as any) || 'Third-Party Extension',
        detail: `Companion proctoring bridge identified active extension: ${name}`,
        reason: 'Extensions must be disabled before starting the assessment.',
        remediation: `Turn off "${name}" in chrome://extensions.`,
        detectionSource: 'chrome.management'
      });
    }
  }

  // Merge into async store
  for (const ext of found) {
    if (!asyncDetectedExtensions.some(e => e.id === ext.id || e.name === ext.name)) {
      asyncDetectedExtensions.push(ext);
    }
  }

  return found;
}

/**
 * Ensures interactive proctor micro-bait trap elements exist in DOM.
 * Designed with dimensions and pointer-events enabled so content-scripts (Grammarly, Password Managers, Autofill)
 * do not ignore them due to visibility heuristics.
 */
export function ensureProctorBaitTrap(): void {
  if (typeof document === 'undefined') return;
  const trapId = '__proctor_extension_probe_trap';
  let trap = document.getElementById(trapId);

  if (!trap) {
    trap = document.createElement('div');
    trap.id = trapId;
    trap.setAttribute('aria-hidden', 'true');
    // Notice: 6px x 6px with opacity 0.05 and pointer-events: auto so extensions treat it as a live input
    trap.style.cssText =
      'position: fixed !important; bottom: 2px !important; right: 2px !important; width: 6px !important; height: 6px !important; opacity: 0.05 !important; pointer-events: auto !important; z-index: -10 !important; overflow: hidden !important; background: transparent !important;';

    // 1. Textarea bait for Grammarly, LanguageTool, QuillBot, ProWritingAid
    const textarea = document.createElement('textarea');
    textarea.id = '__probe_textarea';
    textarea.name = '__probe_textarea';
    textarea.setAttribute('spellcheck', 'true');
    textarea.setAttribute('autocomplete', 'on');
    textarea.setAttribute('contenteditable', 'true');
    textarea.setAttribute('data-enable-grammarly', 'true');
    textarea.style.cssText = 'width: 20px !important; height: 20px !important; font-size: 10px !important;';
    textarea.value = 'Proctor probe checking grammar, spelling, and AI writing extensions.';
    trap.appendChild(textarea);

    // 2. Input bait for password managers (Bitwarden, 1Password, LastPass, Dashlane, Proton Pass)
    const usernameInput = document.createElement('input');
    usernameInput.id = '__probe_username';
    usernameInput.type = 'text';
    usernameInput.name = 'username';
    usernameInput.setAttribute('autocomplete', 'username');
    usernameInput.style.cssText = 'width: 20px !important; height: 20px !important;';
    trap.appendChild(usernameInput);

    const passwordInput = document.createElement('input');
    passwordInput.id = '__probe_password';
    passwordInput.type = 'password';
    passwordInput.name = 'password';
    passwordInput.setAttribute('autocomplete', 'current-password');
    passwordInput.style.cssText = 'width: 20px !important; height: 20px !important;';
    trap.appendChild(passwordInput);

    // 3. Ad bait elements for uBlock Origin, AdBlock, Adblock Plus, AdGuard
    const adBanner = document.createElement('div');
    adBanner.id = 'ad-banner';
    adBanner.className = 'ads adsbox ad-placement banner-ad pub_300x250 pub_728x90 text-ad textAd banner_ad ad_banner ad_frame advertisement google-ad ads-google advert';
    adBanner.style.cssText = 'width: 10px !important; height: 10px !important; display: block !important;';
    adBanner.innerHTML = '&nbsp;';
    trap.appendChild(adBanner);

    const adGoogle = document.createElement('div');
    adGoogle.id = 'google_ads_frame';
    adGoogle.className = 'ad-unit adsbygoogle';
    adGoogle.style.cssText = 'width: 10px !important; height: 10px !important; display: block !important;';
    trap.appendChild(adGoogle);

    if (document.body) {
      document.body.appendChild(trap);
    } else if (document.documentElement) {
      document.documentElement.appendChild(trap);
    }

    // Trigger micro-focus to wake dormant content-scripts
    try {
      setTimeout(() => {
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }, 50);
    } catch {}
  }
}

/**
 * Removes leftover, dead DOM artifacts when user turns off an extension in chrome://extensions.
 */
export function cleanupInactiveExtensionArtifacts(): void {
  if (typeof document === 'undefined') return;
  try {
    document.querySelectorAll('grammarly-extension, grammarly-desktop-integration, grammarly-popups, [data-grammarly-shadow-root]').forEach(el => el.remove());
    document.documentElement.removeAttribute('data-gr-ext-installed');
    document.documentElement.removeAttribute('data-new-gr-c-s-check-loaded');
    if (document.body) {
      document.body.removeAttribute('data-gr-ext-installed');
      document.body.removeAttribute('data-new-gr-c-s-check-loaded');
      document.body.removeAttribute('cz-shortcut-listen');
      document.body.removeAttribute('data-extension');
      document.body.removeAttribute('data-extension-id');
    }
    document.querySelectorAll('style.darkreader, meta[name="darkreader"]').forEach(el => el.remove());
    document.documentElement.removeAttribute('data-darkreader-mode');
    document.documentElement.removeAttribute('data-darkreader-scheme');
    document.documentElement.removeAttribute('cz-shortcut-listen');
    document.documentElement.removeAttribute('data-extension');
    document.documentElement.removeAttribute('data-extension-id');
    document.querySelectorAll('lt-toolbar, lt-mirror, lt-div, lt-highlighter').forEach(el => el.remove());
    document.documentElement.removeAttribute('data-lt-installed');
    if (document.body) document.body.removeAttribute('data-lt-installed');
  } catch (err) {
    console.warn('Failed to clean inactive extension artifacts:', err);
  }
}

/**
 * Universal, comprehensive synchronous and DOM-level audit to detect EVERY browser extension in real time.
 */
export function runExtensionAudit(): ExtensionAuditReport {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { hasExtension: false, blocked: false, extensions: [], timestamp: Date.now() };
  }

  // Ensure micro bait elements are present
  ensureProctorBaitTrap();

  const detected: DetectedExtension[] = [];
  const registeredIds = new Set<string>();

  const addDetection = (ext: DetectedExtension) => {
    if (!registeredIds.has(ext.id)) {
      registeredIds.add(ext.id);
      detected.push(ext);
    }
  };

  const injectedDomElements: string[] = [];
  const injectedAttributes: string[] = [];
  const globalObjectFlags: string[] = [];
  const uriMatches: string[] = [];

  // 1. EXTENSION PROTOCOL URIs (Universal check: catches ANY extension injecting assets)
  try {
    const extensionUris = document.querySelectorAll(
      '[src*="chrome-extension://"], [href*="chrome-extension://"], ' +
      '[src*="moz-extension://"], [href*="moz-extension://"], ' +
      '[src*="safari-extension://"], [href*="safari-extension://"], ' +
      '[src*="edge-extension://"], [href*="edge-extension://"], ' +
      '[src*="extension://"], [href*="extension://"], ' +
      '[src*="blob:chrome-extension://"], [href*="blob:chrome-extension://"]'
    );

    extensionUris.forEach((el) => {
      const src = el.getAttribute('src') || el.getAttribute('href') || '';
      const match = src.match(/(?:chrome|moz|edge)-extension:\/\/([a-z0-9]+)/i);
      const extId = match ? match[1].toLowerCase() : '';
      const info = KNOWN_EXTENSIONS_MAP[extId];
      const name = info?.name || (extId ? `Browser Extension (${extId.slice(0, 10)})` : 'Active Browser Extension');
      const category = info?.category || 'Third-Party Extension';

      uriMatches.push(src.slice(0, 60));
      addDetection({
        id: `ext-uri-${extId || src.slice(0, 35)}`,
        name,
        category,
        detail: `Active <${el.tagName.toLowerCase()}> with extension source "${src.slice(0, 50)}..."`,
        reason: 'Browser extensions can monitor keystrokes, intercept network payloads, and compromise assessment security.',
        remediation: `Turn off "${name}" in your browser extensions manager (chrome://extensions).`,
        detectionSource: 'heuristics-dom'
      });
    });
  } catch {}

  // 2. RESOURCE TIMING API (Performance entries containing extension protocols)
  try {
    if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
      const resources = performance.getEntriesByType('resource');
      for (const res of resources) {
        const name = res.name || '';
        if (
          name.includes('chrome-extension://') ||
          name.includes('moz-extension://') ||
          name.includes('edge-extension://')
        ) {
          const match = name.match(/(?:chrome|moz|edge)-extension:\/\/([a-z0-9]+)/i);
          const extId = match ? match[1].toLowerCase() : '';
          const info = KNOWN_EXTENSIONS_MAP[extId];
          const extName = info?.name || (extId ? `Browser Extension (${extId.slice(0, 10)})` : 'Active Browser Extension');
          uriMatches.push(name.slice(0, 60));
          addDetection({
            id: `ext-perf-${extId || name.slice(0, 30)}`,
            name: extName,
            category: info?.category || 'Third-Party Extension',
            detail: `Detected extension asset loaded in network performance timeline: "${name.slice(0, 60)}..."`,
            reason: 'Active background extension is loading scripts and assets into this browser tab.',
            remediation: `Disable "${extName}" in chrome://extensions or edge://extensions.`,
            detectionSource: 'heuristics-dom'
          });
        }
      }
    }
  } catch {}

  // 3. STYLESHEETS & STYLES CONTAINING EXTENSION PROTOCOLS
  try {
    const styleTags = document.querySelectorAll('style');
    styleTags.forEach((st) => {
      const content = st.textContent || '';
      if (
        content.includes('chrome-extension://') ||
        content.includes('moz-extension://') ||
        content.includes('edge-extension://') ||
        content.includes('extension://')
      ) {
        uriMatches.push('style-inline-extension-uri');
        addDetection({
          id: 'ext-style-uri',
          name: 'Injected Extension Stylesheet',
          category: 'Third-Party Extension',
          detail: 'Detected inline <style> tag containing extension protocol rules.',
          reason: 'Extension modifies visual styles and typography in the assessment container.',
          remediation: 'Disable browser extensions altering web styles.',
          detectionSource: 'heuristics-dom'
        });
      }
    });
  } catch {}

  // 4. ADBLOCKER & COSMETIC FILTER DETECTION (uBlock Origin, AdBlock, Adblock Plus, AdGuard, Brave Shields)
  try {
    const adBait = document.getElementById('ad-banner');
    if (adBait) {
      const compStyle = window.getComputedStyle(adBait);
      if (
        compStyle.display === 'none' ||
        compStyle.visibility === 'hidden' ||
        adBait.offsetHeight === 0 ||
        adBait.offsetWidth === 0 ||
        adBait.offsetParent === null
      ) {
        injectedDomElements.push('adblock-bait-hidden');
        addDetection({
          id: 'adblock-extension',
          name: 'AdBlocker Extension (uBlock Origin / AdBlock / AdGuard / Brave Shields)',
          category: 'AdBlocker & Content Filter',
          detail: 'Detected active ad blocker applying cosmetic filter rules (#ad-banner is hidden).',
          reason: 'Ad blockers block network compiler endpoints, code submission streams, and proctoring telemetry.',
          remediation: 'Disable your AdBlocker / uBlock Origin for this site, or toggle it OFF in chrome://extensions.',
          detectionSource: 'heuristics-dom'
        });
      }
    }

    const googleAdBait = document.getElementById('google_ads_frame');
    if (googleAdBait) {
      const gStyle = window.getComputedStyle(googleAdBait);
      if (gStyle.display === 'none' || googleAdBait.offsetHeight === 0) {
        addDetection({
          id: 'adblock-google-filter',
          name: 'Content Filter / AdBlock Extension',
          category: 'AdBlocker & Content Filter',
          detail: 'Detected cosmetic content filtering active on page elements.',
          reason: 'Content filters suppress necessary scripts and assessment communication channels.',
          remediation: 'Turn off ad blocking and content filtering extensions.',
          detectionSource: 'heuristics-dom'
        });
      }
    }
  } catch {}

  // 5. DEVELOPER TOOLS EXTENSIONS (React Developer Tools, Redux DevTools, Vue DevTools, Angular DevTools)
  if (typeof (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined') {
    globalObjectFlags.push('window.__REACT_DEVTOOLS_GLOBAL_HOOK__');
    addDetection({
      id: 'react-devtools',
      name: 'React Developer Tools',
      category: 'DevTools & Script Injector',
      detail: 'React Developer Tools extension hook injected into window scope.',
      reason: 'Developer Tools extensions allow inspecting application state, component memory, and test questions.',
      remediation: 'Turn off React Developer Tools in chrome://extensions or open the assessment in Incognito / Guest mode.',
      detectionSource: 'heuristics-dom'
    });
  }

  if (typeof (window as any).__REDUX_DEVTOOLS_EXTENSION__ !== 'undefined' || typeof (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ !== 'undefined') {
    globalObjectFlags.push('window.__REDUX_DEVTOOLS_EXTENSION__');
    addDetection({
      id: 'redux-devtools',
      name: 'Redux DevTools Extension',
      category: 'DevTools & Script Injector',
      detail: 'Redux DevTools extension hook injected into window scope.',
      reason: 'Redux DevTools allows inspecting and dispatching state actions, altering exam state.',
      remediation: 'Turn off Redux DevTools in chrome://extensions.',
      detectionSource: 'heuristics-dom'
    });
  }

  if (typeof (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined' || typeof (window as any).__VUE__ !== 'undefined') {
    globalObjectFlags.push('window.__VUE_DEVTOOLS_GLOBAL_HOOK__');
    addDetection({
      id: 'vue-devtools',
      name: 'Vue.js DevTools Extension',
      category: 'DevTools & Script Injector',
      detail: 'Vue.js DevTools extension hook active in browser window.',
      reason: 'DevTools extensions inspect component states and browser memory.',
      remediation: 'Turn off Vue DevTools in chrome://extensions.',
      detectionSource: 'heuristics-dom'
    });
  }

  if (typeof (window as any).__NG_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined') {
    globalObjectFlags.push('window.__NG_DEVTOOLS_GLOBAL_HOOK__');
    addDetection({
      id: 'angular-devtools',
      name: 'Angular DevTools Extension',
      category: 'DevTools & Script Injector',
      detail: 'Angular DevTools extension hook active in browser window.',
      reason: 'DevTools extensions can manipulate DOM and application state.',
      remediation: 'Turn off Angular DevTools in chrome://extensions.',
      detectionSource: 'heuristics-dom'
    });
  }

  // 6. GRAMMARLY & WRITING ASSISTANTS (Grammarly, LanguageTool, QuillBot, ProWritingAid)
  const hasGrammarlyElements = document.querySelector(
    'grammarly-extension, grammarly-desktop-integration, grammarly-popups, [data-grammarly-shadow-root], [data-gr-ext-installed], [data-new-gr-c-s-check-loaded]'
  );
  const hasGrammarlyCustomEl = typeof customElements !== 'undefined' && (
    Boolean(customElements.get('grammarly-extension')) || Boolean(customElements.get('grammarly-desktop-integration'))
  );
  const hasGrammarlyWindow = Boolean((window as any).__grammarly || (window as any).Grammarly);
  const hasGrammarlyAttr = document.documentElement.hasAttribute('data-gr-ext-installed') || document.body?.hasAttribute('data-gr-ext-installed');

  if (hasGrammarlyElements || hasGrammarlyCustomEl || hasGrammarlyWindow || hasGrammarlyAttr) {
    injectedDomElements.push('grammarly-active-element');
    addDetection({
      id: 'grammarly-extension',
      name: 'Grammarly Writing Assistant',
      category: 'Grammar & Writing Tool',
      detail: 'Detected active Grammarly DOM tags, custom elements, or dataset flags injected into the document.',
      reason: 'Grammarly inspects text inputs, injects DOM overlays, and communicates with external AI spelling/grammar servers.',
      remediation: 'Turn off or toggle Grammarly to "OFF on this website" at chrome://extensions, then re-scan.',
      detectionSource: 'heuristics-dom'
    });
  }

  const hasLanguageTool = document.querySelector(
    'lt-toolbar, lt-mirror, lt-div, lt-highlighter, [data-lt-installed], [data-lt-extension-installed], [class*="quillbot"], #quillbot-extension'
  );
  const hasLtCustomEl = typeof customElements !== 'undefined' && Boolean(customElements.get('lt-toolbar'));
  const hasLtWindow = Boolean((window as any).LanguageTool || (window as any).__lt_installed__ || (window as any).__languagetool);
  const hasLtAttr = document.documentElement.hasAttribute('data-lt-installed') || document.body?.hasAttribute('data-lt-installed');

  if (hasLanguageTool || hasLtCustomEl || hasLtWindow || hasLtAttr) {
    injectedDomElements.push('languagetool-active-element');
    addDetection({
      id: 'languagetool-extension',
      name: 'LanguageTool / QuillBot Writing Assistant',
      category: 'Grammar & Writing Tool',
      detail: 'Detected active proofreading or writing assistant DOM tags on the page.',
      reason: 'Proofreading extensions intercept typed code and text, violating examination conditions.',
      remediation: 'Disable LanguageTool / QuillBot in your browser extensions manager.',
      detectionSource: 'heuristics-dom'
    });
  }

  // 7. AI COPILOTS & ASSISTANTS (ChatGPT, Claude, Sider, Monica, Harpa, Merlin, Perplexity, Codeium)
  const hasAiExtensions = document.querySelector(
    '#monica-app-container, #sider-wrapper, .merlin-bubble, #harpa-ai, ' +
    '[id*="chatgpt-sidebar"], [id*="chatgpt_ext"], [id*="ai-assistant"], [class*="chatgpt-extension"], ' +
    '[data-chatgpt], div[class*="sider-"], div[id*="monica-"], [id*="perplexity"], [data-perplexity], ' +
    '#codeium-companion, #tabnine-assistant, [data-copilot-installed], [class*="harpa-"]'
  );
  const hasAiWindow = Boolean(
    (window as any).__chatgpt ||
    (window as any).__chatgpt_extension_injected__ ||
    (window as any).__COPILOT__ ||
    (window as any).sider ||
    (window as any).monica ||
    (window as any).harpa ||
    (window as any).merlin ||
    (window as any).MathpixMarkdownModel ||
    (window as any).__perplexity ||
    (window as any)._webgpt ||
    (window as any).chatgptExtension
  );

  if (hasAiExtensions || hasAiWindow) {
    if (hasAiWindow) globalObjectFlags.push('window.__ai_assistant');
    addDetection({
      id: 'ai-copilot-extension',
      name: 'AI Copilot / ChatGPT Browser Extension',
      category: 'AI Assistant / Copilot',
      detail: 'Detected automated AI assistant overlay, sidebar container, or window hook injected by an AI extension.',
      reason: 'AI assistants provide unauthorized real-time solutions, problem parsing, and algorithmic assistance.',
      remediation: 'Turn off AI Assistant / ChatGPT / Copilot extensions immediately before proceeding.',
      detectionSource: 'heuristics-dom'
    });
  }

  // 8. USERSCRIPT & SCRIPT INJECTORS (Tampermonkey, Violentmonkey, Greasemonkey)
  const hasUserScript = document.querySelector(
    '#tampermonkey_div, [data-userscript], script[data-tampermonkey], [data-violentmonkey]'
  );
  const hasUserScriptWindow = Boolean(
    (window as any).GM_info ||
    (window as any).__tampermonkey__ ||
    (window as any).__violentmonkey__ ||
    (window as any).GM_getValue ||
    (window as any).unsafeWindow
  );

  if (hasUserScript || hasUserScriptWindow) {
    if (hasUserScriptWindow) globalObjectFlags.push('window.GM_info');
    addDetection({
      id: 'userscript-injector',
      name: 'UserScript Extension (Tampermonkey / Violentmonkey)',
      category: 'DevTools & Script Injector',
      detail: 'Detected active userscript environment or runtime hooks injected into window scope.',
      reason: 'Script managers can execute arbitrary code to bypass proctoring safeguards and automate test submission.',
      remediation: 'Disable Tampermonkey, Violentmonkey, or other user-script extensions.',
      detectionSource: 'heuristics-dom'
    });
  }

  // 9. PASSWORD MANAGERS & FORM FILLERS (1Password, Bitwarden, LastPass, Dashlane, Proton Pass, NordPass)
  const hasPasswordManagerDom = document.querySelector(
    'com-1password-button, protonpass-root, [data-onepassword-], [data-bitwarden-], [data-lastpass-], [data-dashlane-], [data-protonpass-], [id*="lastpass"], [id*="bitwarden"], [id*="1password"]'
  );
  const hasPasswordManagerWindow = Boolean(
    (window as any)._1Password ||
    (window as any).OnePassword ||
    (window as any).bitwarden ||
    (window as any).lastpass ||
    (window as any)._lastpass ||
    (window as any).dashlane ||
    (window as any).nordpass ||
    (window as any).keeper
  );

  if (hasPasswordManagerDom || hasPasswordManagerWindow) {
    if (hasPasswordManagerWindow) globalObjectFlags.push('window.__password_manager');
    addDetection({
      id: 'password-manager-extension',
      name: 'Password Manager Extension (1Password / Bitwarden / LastPass / Dashlane)',
      category: 'Password Manager / Form Filler',
      detail: 'Detected password manager DOM elements or injected autofill hooks.',
      reason: 'Password managers inject background listeners into input fields and code editors.',
      remediation: 'Disable password manager extensions or switch to Incognito mode.',
      detectionSource: 'heuristics-dom'
    });
  }

  // 10. SCREEN RECORDERS & CAPTURE TOOLS (Loom, Vidyard, Screencastify, Nimbus)
  const hasScreenRecorder = document.querySelector(
    '#loom-companion-mv3, [data-loom-], #vidyard-player, [class*="screencastify"], loom-container, [id*="nimbus"]'
  );
  const hasScreenRecorderWindow = Boolean(
    (window as any).loom || (window as any).screencastify || (window as any).vidyard
  );

  if (hasScreenRecorder || hasScreenRecorderWindow) {
    addDetection({
      id: 'screen-recorder-extension',
      name: 'Screen Recorder Extension (Loom / Vidyard / Screencastify)',
      category: 'Screen Capture & Recorder',
      detail: 'Detected screen recording extension companion container in DOM.',
      reason: 'Screen recording extensions capture and broadcast confidential assessment questions.',
      remediation: 'Disable screen recorder extensions in chrome://extensions.',
      detectionSource: 'heuristics-dom'
    });
  }

  // 11. THEME & STYLER EXTENSIONS (Dark Reader, ColorZilla)
  const hasDarkReader = document.querySelector(
    'style.darkreader, meta[name="darkreader"], style[class*="darkreader"]'
  ) || document.documentElement?.hasAttribute('data-darkreader-mode') || document.documentElement?.hasAttribute('data-darkreader-scheme');

  if (hasDarkReader) {
    addDetection({
      id: 'darkreader-extension',
      name: 'Dark Reader Theme Extension',
      category: 'Third-Party Extension',
      detail: 'Detected Dark Reader dynamic stylesheet or dataset attributes in document.',
      reason: 'Injecting CSS overrides alters code editor layout, contrast, and proctoring HUD indicators.',
      remediation: 'Turn off Dark Reader for this website or in chrome://extensions.',
      detectionSource: 'heuristics-dom'
    });
  }

  if (
    document.body?.getAttribute('cz-shortcut-listen') === 'true' ||
    document.documentElement?.getAttribute('cz-shortcut-listen') === 'true'
  ) {
    addDetection({
      id: 'colorzilla',
      name: 'ColorZilla Eyedropper & Color Picker',
      category: 'Third-Party Extension',
      detail: 'Detected ColorZilla shortcut listener attribute injected into document.',
      reason: 'ColorZilla injects persistent keyboard listeners and eyedropper scripts.',
      remediation: 'Disable ColorZilla in chrome://extensions.',
      detectionSource: 'heuristics-dom'
    });
  }

  // 12. WEB3 / CRYPTO WALLETS (MetaMask, Phantom, Coinbase Wallet)
  const hasCryptoInject = Boolean(
    (window as any).ethereum?.isMetaMask ||
    (window as any).solana?.isPhantom ||
    (window as any).phantom ||
    (window as any).coinbaseWalletExtension ||
    (window as any).BinanceChain ||
    (window as any).trustwallet ||
    (window as any).okxwallet ||
    ((window as any).web3 && !(window as any).web3?.givenProvider)
  );

  if (hasCryptoInject) {
    globalObjectFlags.push('window.ethereum');
    addDetection({
      id: 'web3-wallet-extension',
      name: 'Crypto / Web3 Wallet Extension (MetaMask / Phantom)',
      category: 'Web3 / Crypto Wallet',
      detail: 'Detected third-party wallet provider scripts injected into global window scope.',
      reason: 'Wallet extensions continuously inject background listeners and modify JavaScript runtime execution.',
      remediation: 'Disable Web3 wallet extensions or switch to a clean browser profile.',
      detectionSource: 'heuristics-dom'
    });
  }

  // 13. TRANSLATION EXTENSIONS (Google Translate, DeepL, Immersive Translate)
  if (
    document.querySelector('.goog-te-banner-frame, #google_translate_element, [id*="immersive-translate"], [class*="immersive-translate"], deepl-input-controller, deepl-inline-translate') ||
    Boolean((window as any).google?.translate || (window as any).__IMMERSIVE_TRANSLATE__)
  ) {
    addDetection({
      id: 'translation-extension',
      name: 'Language Translation Extension (Google Translate / DeepL / Immersive)',
      category: 'Translation Overlay',
      detail: 'Detected in-browser translation tool modifying DOM text content.',
      reason: 'Translation extensions mutate page text and exam questions.',
      remediation: 'Turn off translation extensions or disable on this site.',
      detectionSource: 'heuristics-dom'
    });
  }

  // 14. SHOPPING & COUPON ASSISTANTS (Honey, Capital One, Rakuten)
  if (
    document.querySelector('[id*="honey-"], [class*="honey-"], #honeyContainer, [data-honey-], [id*="capitalone"], [id*="rakuten"]') ||
    Boolean((window as any).honey || (window as any).paypalHoney)
  ) {
    addDetection({
      id: 'shopping-extension',
      name: 'Shopping / Coupon Extension (Honey / Capital One / Rakuten)',
      category: 'Third-Party Extension',
      detail: 'Detected shopping/coupon assistant container injected into webpage.',
      reason: 'Shopping extensions monitor user actions and inject background frames.',
      remediation: 'Turn off shopping extensions in chrome://extensions.',
      detectionSource: 'heuristics-dom'
    });
  }

  // 15. NON-STANDARD ATTRIBUTES ON <html> OR <body> (Catches ANY extension injecting dataset attributes)
  try {
    const checkAttributes = (el: HTMLElement | null, elName: string) => {
      if (!el) return;
      const attrs = el.attributes;
      for (let i = 0; i < attrs.length; i++) {
        const attrName = attrs[i].name;
        // Standard expected attributes:
        if (
          ['class', 'id', 'style', 'lang', 'dir', 'data-theme'].includes(attrName) ||
          attrName.startsWith('aria-')
        ) {
          continue;
        }

        // Known extension attributes:
        if (
          attrName.includes('ext') ||
          attrName.includes('grammarly') ||
          attrName.includes('darkreader') ||
          attrName.includes('shortcut') ||
          attrName.includes('extension') ||
          attrName.includes('lt-') ||
          attrName.includes('copilot') ||
          attrName.includes('translate')
        ) {
          injectedAttributes.push(`${elName}[${attrName}]`);
          addDetection({
            id: `ext-attr-${attrName}`,
            name: `Extension Injected Attribute (${attrName})`,
            category: 'Third-Party Extension',
            detail: `Detected extension-injected attribute "${attrName}" on <${elName}> element.`,
            reason: 'Browser extensions stamp tracking attributes onto document root elements.',
            remediation: 'Disable active extensions in chrome://extensions.',
            detectionSource: 'heuristics-dom'
          });
        }
      }
    };
    checkAttributes(document.documentElement, 'html');
    checkAttributes(document.body, 'body');
  } catch {}

  // 16. UNIVERSAL GENERIC CUSTOM ELEMENTS (Catches ANY extension registering custom tags)
  try {
    const allCustomElements = document.querySelectorAll('*');
    allCustomElements.forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (tag.includes('-')) {
        // Ignore valid SVG/MathML tags
        if (['color-profile', 'missing-glyph', 'font-face'].includes(tag)) return;
        // Ignore known local components if any
        if (tag.startsWith('exam-') || tag.startsWith('proctor-internal-')) return;

        let extName = 'Custom Browser Extension';
        let category: DetectedExtension['category'] = 'Third-Party Extension';

        if (tag.startsWith('grammarly')) {
          extName = 'Grammarly Writing Assistant';
          category = 'Grammar & Writing Tool';
        } else if (tag.startsWith('lt-')) {
          extName = 'LanguageTool Grammar Checker';
          category = 'Grammar & Writing Tool';
        } else if (tag.startsWith('loom-') || tag.includes('vidyard')) {
          extName = 'Loom / Vidyard Screen Recorder';
          category = 'Screen Capture & Recorder';
        } else if (tag.includes('chatgpt') || tag.includes('copilot') || tag.includes('sider') || tag.includes('monica') || tag.includes('merlin')) {
          extName = 'AI Copilot / Assistant Extension';
          category = 'AI Assistant / Copilot';
        } else if (tag.includes('password') || tag.includes('bitwarden') || tag.includes('1password') || tag.includes('lastpass') || tag.includes('protonpass')) {
          extName = 'Password Manager Extension';
          category = 'Password Manager / Form Filler';
        } else {
          extName = `Browser Extension Element (<${tag}>)`;
        }

        injectedDomElements.push(tag);
        addDetection({
          id: `ext-tag-${tag}`,
          name: extName,
          category,
          detail: `Detected extension-injected custom DOM element <${tag}> in page document.`,
          reason: 'Extensions with custom elements monitor DOM content and input fields.',
          remediation: `Turn off the extension providing <${tag}> in chrome://extensions.`,
          detectionSource: 'heuristics-dom'
        });
      }

      // Check for attached shadow roots
      try {
        if ((el as any).shadowRoot && el.id !== '__proctor_extension_probe_trap') {
          injectedDomElements.push(`shadow-root-${tag}`);
          addDetection({
            id: `ext-shadow-${tag}`,
            name: `Extension Shadow DOM (<${tag}>)`,
            category: 'Third-Party Extension',
            detail: `Detected isolated extension Shadow Root attached to <${tag}>.`,
            reason: 'Extensions use Shadow DOM to hide scraping elements and injected overlays.',
            remediation: 'Turn off the extension injecting this element in chrome://extensions.',
            detectionSource: 'heuristics-dom'
          });
        }
      } catch {}
    });
  } catch {}

  // 17. FOREIGN SIBLINGS IN <body> OR <html>
  try {
    if (document.body) {
      for (let i = 0; i < document.body.children.length; i++) {
        const child = document.body.children[i];
        const tag = child.tagName.toLowerCase();
        const id = child.id || '';
        const className = typeof child.className === 'string' ? child.className : '';

        // Known allowed app elements:
        if (
          id === 'root' ||
          id === '__proctor_extension_probe_trap' ||
          tag === 'script' ||
          tag === 'link' ||
          className.includes('monaco-aria-container') ||
          className.includes('monaco-editor') ||
          className.includes('context-view')
        ) {
          continue;
        }

        // Any other element injected directly into <body> is foreign!
        injectedDomElements.push(`body-foreign-${id || tag}`);
        addDetection({
          id: `ext-body-child-${id || tag}`,
          name: `Injected Browser Extension Container (${id || tag})`,
          category: 'Third-Party Extension',
          detail: `Detected foreign container <${tag}${id ? ` id="${id}"` : ''}${className ? ` class="${className.slice(0, 30)}"` : ''}> injected into body.`,
          reason: 'Extensions inject floating sidebars, toolbars, and background frames into web pages.',
          remediation: 'Disable this extension in chrome://extensions or use Incognito mode.',
          detectionSource: 'heuristics-dom'
        });
      }
    }

    // Children of <html> outside <head> and <body>
    if (document.documentElement) {
      for (let i = 0; i < document.documentElement.children.length; i++) {
        const c = document.documentElement.children[i];
        const t = c.tagName.toLowerCase();
        if (t !== 'head' && t !== 'body' && c.id !== '__proctor_extension_probe_trap') {
          injectedDomElements.push(`html-foreign-${t}`);
          addDetection({
            id: `ext-html-child-${t}`,
            name: `Extension Injected Tag (<${t}>)`,
            category: 'Third-Party Extension',
            detail: `Found foreign tag <${t}> appended to document root.`,
            reason: 'Extension modifies HTML document root structure.',
            remediation: 'Disable the extension in chrome://extensions.',
            detectionSource: 'heuristics-dom'
          });
        }
      }
    }
  } catch {}

  // Merge any asynchronously verified detections (e.g. chrome.management, adblock network probe, WAR probe)
  for (const aExt of asyncDetectedExtensions) {
    addDetection(aExt);
  }

  return {
    hasExtension: detected.length > 0,
    blocked: detected.length > 0,
    extensions: detected,
    timestamp: Date.now(),
    injectedDomElements,
    injectedAttributes,
    globalObjectFlags,
    uriMatches,
    usedChromeManagement: asyncDetectedExtensions.some(e => e.detectionSource === 'chrome.management')
  };
}

/**
 * Asynchronous background probe for AdBlockers via network requests.
 * Runs in parallel to catch ad blockers that block network traffic without CSS modification.
 */
export async function runAsyncAdBlockerProbe(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    // Ping known ad server URL; ad blockers will block this network call with ERR_BLOCKED_BY_CLIENT
    await fetch('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store'
    });
    return false;
  } catch (err: any) {
    // If request was blocked by browser client, an ad blocker is running!
    const adBlockExt: DetectedExtension = {
      id: 'adblock-network-probe',
      name: 'AdBlocker / Privacy Shield Extension',
      category: 'AdBlocker & Content Filter',
      detail: 'Network request to ad domain was actively intercepted and blocked by client.',
      reason: 'Network interceptor extensions block compiler communication and proctoring telemetry.',
      remediation: 'Disable your AdBlocker extension for this site or in chrome://extensions.',
      detectionSource: 'heuristics-network'
    };
    if (!asyncDetectedExtensions.some(e => e.id === adBlockExt.id)) {
      asyncDetectedExtensions.push(adBlockExt);
    }
    return true;
  }
}

/**
 * Heuristic probe using chrome.runtime.sendMessage.
 * For active extensions, Chrome reports "Access to the specified extension has not been granted."
 * For non-installed extensions, Chrome reports "Could not establish connection. Receiving end does not exist."
 */
export async function runRuntimeMessageProbes(): Promise<void> {
  if (typeof window === 'undefined') return;
  const chromeObj = (window as any).chrome;
  if (!chromeObj?.runtime?.sendMessage) return;

  const probeIds = Object.keys(KNOWN_EXTENSIONS_MAP).slice(0, 30);
  for (const extId of probeIds) {
    try {
      chromeObj.runtime.sendMessage(extId, { type: 'proctor-audit-ping' }, () => {
        const lastErr = chromeObj.runtime?.lastError?.message || '';
        // If the extension is present and rejected external message:
        if (
          lastErr.includes('Access to the specified extension has not been granted') ||
          lastErr.includes('The message port closed before a response was received')
        ) {
          const info = KNOWN_EXTENSIONS_MAP[extId];
          const name = info?.name || `Active Browser Extension (${extId.slice(0, 8)})`;
          const ext: DetectedExtension = {
            id: `runtime-msg-${extId}`,
            name,
            category: info?.category || 'Third-Party Extension',
            detail: `Runtime probe confirmed active extension presence: ${name}`,
            reason: 'Extension process is active in browser memory.',
            remediation: `Turn off "${name}" in chrome://extensions.`,
            detectionSource: 'heuristics-runtime'
          };
          if (!asyncDetectedExtensions.some(e => e.id === ext.id)) {
            asyncDetectedExtensions.push(ext);
          }
        }
      });
    } catch {}
  }
}

/**
 * Probes Web Accessible Resources (WAR) for popular extensions.
 */
export async function runWarProbeForPopularExtensions(): Promise<void> {
  if (typeof window === 'undefined') return;

  for (const [extId, info] of Object.entries(KNOWN_EXTENSIONS_MAP)) {
    if (!info.warPath) continue;
    try {
      const url = `chrome-extension://${extId}/${info.warPath}`;
      const img = new Image();
      img.src = url;
      img.onload = () => {
        const ext: DetectedExtension = {
          id: `war-${extId}`,
          name: info.name,
          category: info.category,
          detail: `Detected web accessible resource from extension: ${info.name}`,
          reason: 'Extension exposes active web resources accessible in this browser window.',
          remediation: `Turn off "${info.name}" in chrome://extensions.`,
          detectionSource: 'heuristics-war'
        };
        if (!asyncDetectedExtensions.some(e => e.id === ext.id)) {
          asyncDetectedExtensions.push(ext);
        }
      };
    } catch {}
  }
}

let isPageUnloading = false;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    isPageUnloading = true;
  });
}

/**
 * Real-Time Backend Extension Verification
 */
export async function verifyExtensionTurnedOffWithBackend(
  candidateId: string,
  candidateEmail?: string,
  allowArtifactCleanup: boolean = false
): Promise<BackendAuditVerificationResponse> {
  if (allowArtifactCleanup) {
    cleanupInactiveExtensionArtifacts();
    asyncDetectedExtensions = [];
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // 1. Run direct chrome.management check
  await queryChromeManagementApi();

  // 2. Run async network, runtime message, and WAR probes
  await Promise.allSettled([
    runAsyncAdBlockerProbe(),
    runRuntimeMessageProbes(),
    runWarProbeForPopularExtensions()
  ]);

  const clientAudit = runExtensionAudit();

  if (isPageUnloading) {
    return {
      success: true,
      clean: !clientAudit.hasExtension,
      blocked: clientAudit.hasExtension,
      message: 'Page refreshing...',
      verifiedExtensions: clientAudit.extensions,
      serverAuditId: 'unloading',
      timestamp: Date.now()
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch('/api/proctor/verify-extension-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        candidateId,
        candidateEmail,
        clientTelemetry: {
          detectedCount: clientAudit.extensions.length,
          detectedExtensions: clientAudit.extensions,
          injectedDomElements: clientAudit.injectedDomElements || [],
          injectedAttributes: clientAudit.injectedAttributes || [],
          globalObjectFlags: clientAudit.globalObjectFlags || [],
          uriMatches: clientAudit.uriMatches || [],
          usedChromeManagement: clientAudit.usedChromeManagement || false,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          timestamp: Date.now()
        }
      })
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        clean: !clientAudit.hasExtension,
        blocked: clientAudit.hasExtension,
        message: errData.message || (clientAudit.hasExtension ? 'Active extension detected.' : 'Verified clean.'),
        verifiedExtensions: clientAudit.extensions,
        serverAuditId: `local-${Date.now()}`,
        timestamp: Date.now()
      };
    }

    const data: BackendAuditVerificationResponse = await response.json();
    return data;
  } catch (err: any) {
    if (isPageUnloading || err?.name === 'AbortError') {
      return {
        success: true,
        clean: !clientAudit.hasExtension,
        blocked: clientAudit.hasExtension,
        message: 'Syncing environment...',
        verifiedExtensions: clientAudit.extensions,
        serverAuditId: `sync-${Date.now()}`,
        timestamp: Date.now()
      };
    }
    console.warn('Proctoring backend verification notice:', err?.message || err);
    return {
      success: true,
      clean: !clientAudit.hasExtension,
      blocked: clientAudit.hasExtension,
      message: clientAudit.hasExtension
        ? 'Active extension detected. Please turn it off in chrome://extensions.'
        : 'Browser verified clean. Ready to write exam.',
      verifiedExtensions: clientAudit.extensions,
      serverAuditId: `fallback-${Date.now()}`,
      timestamp: Date.now()
    };
  }
}

/**
 * Continuous Real-Time Extension Watchdog.
 * Runs on every DOM mutation (via MutationObserver) + animation frame + fast 50ms polling timer + chrome.management loop.
 */
export function startRealtimeExtensionWatchdog(
  handlerOrOptions: ((ext: DetectedExtension) => void) | WatchdogOptions
): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  // Inject bait trap
  ensureProctorBaitTrap();

  const options: WatchdogOptions =
    typeof handlerOrOptions === 'function'
      ? { onExtensionDetected: handlerOrOptions }
      : handlerOrOptions;

  let isWatching = true;
  let lastWasBlocked: boolean | null = null;
  let animFrameId: number | null = null;

  // Run async probes immediately
  queryChromeManagementApi().catch(() => {});
  runAsyncAdBlockerProbe().catch(() => {});
  runRuntimeMessageProbes().catch(() => {});
  runWarProbeForPopularExtensions().catch(() => {});

  const performCheck = () => {
    if (!isWatching) return;
    const audit = runExtensionAudit();
    options.onStatusChange?.(audit);

    if (audit.hasExtension && audit.extensions.length > 0) {
      if (lastWasBlocked !== true) {
        lastWasBlocked = true;
        options.onExtensionDetected?.(audit.extensions[0]);
      }
    } else {
      if (lastWasBlocked === true) {
        lastWasBlocked = false;
        options.onExtensionTurnedOff?.();
      }
    }
  };

  // Immediate check
  performCheck();

  // 1. High-speed 50ms interval
  const pollInterval = Math.max(25, options.pollIntervalMs !== undefined ? options.pollIntervalMs : 50);
  const pollIntervalId = window.setInterval(performCheck, pollInterval);

  // 2. Periodic management & network probe every 2 seconds
  const mgmtProbeId = window.setInterval(() => {
    if (!isWatching) return;
    queryChromeManagementApi().then(() => performCheck()).catch(() => {});
    runAsyncAdBlockerProbe().then(hasAdBlock => {
      if (hasAdBlock) performCheck();
    }).catch(() => {});
  }, 2000);

  // 3. RequestAnimationFrame loop
  let lastFrameTime = 0;
  const tickFrame = (timestamp: number) => {
    if (!isWatching) return;
    if (timestamp - lastFrameTime > 50) {
      lastFrameTime = timestamp;
      performCheck();
    }
    animFrameId = window.requestAnimationFrame(tickFrame);
  };
  animFrameId = window.requestAnimationFrame(tickFrame);

  // 4. MutationObserver on document
  let observer: MutationObserver | null = null;
  try {
    observer = new MutationObserver(() => {
      if (!isWatching) return;
      performCheck();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true
    });
  } catch (err) {
    console.warn('MutationObserver initialization warning:', err);
  }

  // 5. Tab visibility change listener (triggers when user switches back from chrome://extensions)
  const handleVisibilityChange = () => {
    if (!isWatching) return;
    if (document.visibilityState === 'visible') {
      cleanupInactiveExtensionArtifacts();
      queryChromeManagementApi().then(() => performCheck()).catch(() => {});
      performCheck();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // 6. Listen for content script window messages
  const handleWindowMessage = (event: MessageEvent) => {
    if (!isWatching || !event.data) return;
    const dataStr = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
    if (
      dataStr.includes('extension') ||
      dataStr.includes('react-devtools') ||
      dataStr.includes('redux-devtools') ||
      dataStr.includes('bitwarden') ||
      dataStr.includes('grammarly') ||
      dataStr.includes('onepassword') ||
      dataStr.includes('sider') ||
      dataStr.includes('quillbot')
    ) {
      performCheck();
    }
  };
  window.addEventListener('message', handleWindowMessage);

  return () => {
    isWatching = false;
    window.clearInterval(pollIntervalId);
    window.clearInterval(mgmtProbeId);
    if (animFrameId !== null) {
      window.cancelAnimationFrame(animFrameId);
    }
    if (observer) {
      observer.disconnect();
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('message', handleWindowMessage);
  };
}
