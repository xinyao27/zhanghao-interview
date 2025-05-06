const key = "chatSessionId";
export const chatLocalStorage = {
  getSessionId: () => {
    return localStorage.getItem(key);
  },
  setSessionId: (sessionId: string) => {
    localStorage.setItem(key, sessionId);
  },
  getLastSessionId: () => {
    return localStorage.getItem(key);
  },
  removeSessionId: () => {
    localStorage.removeItem(key);
  },
};
