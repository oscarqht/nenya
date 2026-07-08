# Nenya: Your Universal Browser Companion

Nenya empowers you to seamlessly manage your bookmarks, tabs, and data across all your browsers, so you're never locked into a single ecosystem.

Nenya is the ultimate browser extension for users who refuse to be tied down to a single browser. It provides a comprehensive suite of tools to manage your tabs, bookmarks, and settings, and makes it easy to take your data with you, no matter which browser you're using. With Nenya, you can integrate with Raindrop.io and enjoy a variety of content interaction features that enhance your browsing experience.

🌟 Features

🚀 Latest Updates (v1.46.0 - v1.49.0)
• Tab Rename: Rename the current tab instantly from popup or keyboard shortcut
• Screen Recording: Start/stop recording with one shortcut, then preview and download
• Faster Raindrop Saves: Optimized Unsorted saving with batch APIs and parallel processing
• Performance Improvements: Faster highlight matching, Raindrop saves, and content capture workflows

🗂️ Tab Management
• Automatic tab state preservation with snapshots
• Quick keyboard shortcuts to navigate between tabs
• Rename the active tab title directly from popup or shortcut
• Customize your popup toolbar with pinned shortcuts

🔄 Cross-Browser & Sync
• Seamlessly move bookmarks, settings, and data between browsers
• Full Raindrop.io integration with two-way sync
✓ Pull collections from Raindrop
✓ Save tabs to Raindrop Unsorted (with optional custom title)
✓ Encrypt & save to Raindrop Unsorted with password-protected links
✓ Mirror Raindrop collections as bookmarks
✓ Automatic background synchronization
• Export and import extension settings as local JSON files

🖥️ Advanced Tab Features
• Auto Reload: Automatically reload pages based on URL patterns
• Bookmark Search: Fast Raindrop search with keyboard navigation
• Custom Search Engines: Add your own keyword + query search shortcuts

📄 Page Content Export
• Smart content extraction:
✓ General web pages (Readability)
✓ YouTube (title, description, transcript)
✓ Notion pages (full content)
✓ Confluence pages (page-aware markdown conversion)
• Download pages as markdown files, including Confluence-aware exports

📋 Clipboard Tools
• Copy page title
• Copy title + URL
• Copy title - URL
• Copy markdown link [Title](URL)
• Copy page screenshot
• Auto-save screenshots to the filesystem (optional)
• Save clipboard URLs directly to Raindrop Unsorted

✨ Content Enhancement
• Custom JavaScript: Inject JS code into specific sites
• Custom CSS: Inject custom styles into specific sites
• YouTube Enhancements: Special optimizations for YouTube
• Emoji Panel: Open anywhere and insert multiple emoji (supports multi-insert)

🎬 Capture & Editing
• Screen Recorder: Record tab/window/screen, then preview and download recordings
• Screenshot Editor: Annotate screenshots with crop, arrow, rectangle, highlight, text, and blur tools
• OCR Support: Extract text from screenshots inside the editor

🔐 Auto Features
• Auto Google Login: Automatically select your preferred Google account (enhanced button recognition)

🔧 URL Processing
• Transform URLs when opening or saving

⚙️ Customization
• Theme support (adapts to system preferences)
• Comprehensive keyboard shortcuts
• Right-click context menu integration
• Desktop notifications for background operations
• Built-in debugging utilities

🔐 Permission justification

- **bookmarks**:
  Required for Raindrop.io integration to mirror collections and items as browser bookmarks. The extension creates, updates, and manages bookmark folders to sync with your Raindrop account. Also enables the built-in bookmark search functionality allowing seamless cross-platform bookmark management.

- **storage**:
  Essential for saving user settings and preferences. Uses both `chrome.storage.sync` for cross-device synchronization of settings (shortcuts, rules, configurations) and `chrome.storage.local` for tab snapshots and runtime data that don't need to sync.

- **tabs**:
  Core functionality for tab management - creates, queries, updates, and manages browser tabs. Enables features like tab switching, screenshots, content capture, and auto-reload.

- **tabGroups**:
  Used in conjunction with tab management to organize related tabs into groups for user workflows such as context-menu actions and split-tab operations.

- **notifications**:
  Provides user feedback for important actions like successful Raindrop synchronization, JSON import/export completion, auto-reload events, auto-login notifications, and error states. Keeps users informed about background operations without interrupting their browsing.

- **contextMenus**:
  Adds right-click menu options for quick access to extension features including clipboard tools (copy title/URL, screenshots) and Raindrop save actions. Provides convenient access to frequently used features.

- **alarms**:
  Enables scheduled background tasks including automatic Raindrop synchronization at regular intervals, and auto-reload functionality for specific tabs based on user-defined URL patterns and time intervals.

- **scripting**:
  Required for content script injection to implement features like custom CSS/JS injection, video controls, picture-in-picture, auto Google login, and Markdown page content extraction across all websites.

- **activeTab**:
  Allows the extension to interact with the currently active tab for features like video controls, Markdown download, screenshots, and clipboard operations without requiring broad host permissions. Used for popup-triggered actions on the current tab.

- **clipboardWrite**:
  Enables copying various content to clipboard including page titles, URLs (various formats), markdown links, and screenshots. Essential for the extension's productivity and sharing features.

- **webNavigation**:
  Required for monitoring page navigation events to implement features such as auto-reload functionality based on URL patterns and URL processing rules that transform URLs when opening in new tabs.

- **host permissions** (`<all_urls>`, `https://api.raindrop.io/*`):
  - `<all_urls>`: Required for content script injection across all websites to provide universal features like custom styling (CSS), custom code (JS), video controls, auto Google login, and Markdown page content extraction.
  - `https://api.raindrop.io/*`: Essential for Raindrop.io integration to sync bookmarks, collections, and user data with the cloud service. Used for pulling collections, pushing new bookmarks, and maintaining two-way synchronization.
