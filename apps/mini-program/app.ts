declare function App(options: { onLaunch?: () => void }): void;

App({
  onLaunch() {
    // The visitor slice is intentionally local until an approved API boundary exists.
  },
});
