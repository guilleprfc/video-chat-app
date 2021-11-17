
/**
 * Check if the current domain is HTTPS
 * @returns boolean (true if it is Https and false if it is Http)
 */
const isHttps = (): boolean => {
  return window.location.protocol === 'https:';
};

/**
 * Get a parameter from URL
 * @param param param key
 * @returns string value or null if it is not defined
 */
const getParamFromUrl = (param: string): string | null => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
};

export { isHttps, getParamFromUrl };
