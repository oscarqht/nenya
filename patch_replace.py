import sys

def replace_in_file(filepath, search_str, replace_str):
    with open(filepath, 'r') as f:
        content = f.read()
    if search_str not in content:
        print(f"Error: Could not find search string in {filepath}")
        return
    content = content.replace(search_str, replace_str)
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Successfully replaced in {filepath}")

replace_in_file(
    'src/popup/popup.js',
    "const FAVORITE_ITEMS_CACHE_TTL_MS = 15 * 60 * 1000;",
    ""
)

replace_in_file(
    'src/popup/popup.js',
    "* @returns {Promise<{items: any[], fetchedAt: number, isValid: boolean, hasCache: boolean}>}",
    "* @returns {Promise<{items: any[], fetchedAt: number, hasCache: boolean}>}"
)

replace_in_file(
    'src/popup/popup.js',
    "return { items: [], fetchedAt: 0, isValid: false, hasCache: false };",
    "return { items: [], fetchedAt: 0, hasCache: false };"
)

replace_in_file(
    'src/popup/popup.js',
    "    isValid: Date.now() - fetchedAt < FAVORITE_ITEMS_CACHE_TTL_MS,",
    ""
)

replace_in_file(
    'src/popup/popup.js',
    """async function refreshFavoriteItems(options) {
  const forceFetch = options?.forceFetch === true;
  const cache = await getFavoriteItemsCache();
  if (cache.hasCache) {
    await renderFavoriteItems(cache.items);
  }

  if (cache.hasCache && cache.isValid && !forceFetch) {
    return cache.items;
  }

  setFavoritesLoading(true);""",
    """async function refreshFavoriteItems() {
  const cache = await getFavoriteItemsCache();
  if (cache.hasCache) {
    await renderFavoriteItems(cache.items);
  }

  if (!cache.hasCache || cache.items.length === 0) {
    setFavoritesLoading(true);
  }"""
)

replace_in_file(
    'src/popup/popup.js',
    """    await renderFavoriteItems(items);
    return normalizeFavoriteItems(items);""",
    """    return applyFavoriteItemsCache(items);"""
)

replace_in_file(
    'src/popup/popup.js',
    """  void refreshFavoriteItems({ forceFetch: true }).catch((error) => {""",
    """  void refreshFavoriteItems().catch((error) => {"""
)
