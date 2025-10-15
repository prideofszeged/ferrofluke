/**
 * Simple tab manager for the controls sidebar.
 */
export class TabManager {
  constructor(container) {
    this.container = container;
    this.tabs = [];
    this.activeTab = null;

    this.init();
  }

  init() {
    // Find all tab buttons and content
    const tabButtons = this.container.querySelectorAll('[data-tab-button]');
    const tabContents = this.container.querySelectorAll('[data-tab-content]');

    this.tabs = Array.from(tabButtons).map((button, index) => {
      const tabId = button.getAttribute('data-tab-button');
      const content = this.container.querySelector(`[data-tab-content="${tabId}"]`);

      return {
        id: tabId,
        button,
        content,
      };
    });

    // Attach click handlers
    this.tabs.forEach((tab) => {
      tab.button.addEventListener('click', () => {
        this.switchTo(tab.id);
      });
    });

    // Activate first tab by default
    if (this.tabs.length > 0) {
      const defaultTab = this.tabs.find(t => t.button.classList.contains('active'));
      this.switchTo(defaultTab ? defaultTab.id : this.tabs[0].id);
    }
  }

  switchTo(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    // Deactivate all tabs
    this.tabs.forEach(t => {
      t.button.classList.remove('active');
      if (t.content) {
        t.content.classList.remove('active');
      }
    });

    // Activate selected tab
    tab.button.classList.add('active');
    if (tab.content) {
      tab.content.classList.add('active');
    }

    this.activeTab = tabId;
  }

  getActiveTab() {
    return this.activeTab;
  }
}
