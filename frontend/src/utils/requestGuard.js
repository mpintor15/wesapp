// Prevents a slower, superseded request from overwriting the state set by a
// newer one (e.g. the response to the first keystroke of a search landing
// after the response to the second). Each call to `start()` invalidates any
// request started before it; check `isCurrent(token)` before applying a
// response to state.
const createRequestGuard = () => {
  let latestToken = 0;
  return {
    start: () => {
      latestToken += 1;
      return latestToken;
    },
    isCurrent: (token) => token === latestToken,
  };
};

export default createRequestGuard;
