/**
 * Cross-Platform Anti-Screenshot & Screen Recording Logic.
 */

const Security = {
    /**
     * Mobile (Android/iOS) Specific Logic.
     */
    setSecureFlag: (enabled) => {
        if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
            // Android: Call NativeModule to set WindowManager.LayoutParams.FLAG_SECURE
            // Native code (Java) would look like:
            // getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
            console.log(`[Mobile Security] Invoking NativeModule.setSecureFlag(${enabled})`);
        }
    },

    /**
     * Windows (Electron/Tauri) Specific Logic.
     */
    setWindowContentProtection: (enabled) => {
        if (process.versions && process.versions.electron) {
            // Electron: win.setContentProtection(enabled)
            // https://www.electronjs.org/docs/latest/api/browser-window#winsetcontentprotectionenable-macos-windows
            console.log(`[Electron Security] win.setContentProtection(${enabled})`);
        } else if (window.__TAURI__) {
            // Tauri: Requires 'tauri-plugin-window-state' or custom Rust command
            // Rust: window.set_content_protection(enabled)
            console.log(`[Tauri Security] tauri.invoke('set_content_protection', { enabled: ${enabled} })`);
        }
    },

    /**
     * Visual Countermeasure: "Hold-to-View" Blur
     * A CSS-based approach to ensure content is only visible during active interaction.
     */
    getBlurStyle: (isHolding) => {
        return {
            filter: isHolding ? 'none' : 'blur(20px)',
            transition: 'filter 0.3s ease-in-out',
            userSelect: 'none',
            WebkitUserSelect: 'none'
        };
    }
};

module.exports = Security;
