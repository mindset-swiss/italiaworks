import TagManager from 'react-gtm-module';
import { LOCATION_CHANGED } from '../ducks/routing.duck';

// Create a Redux middleware from the given analytics handlers. Each
// handler should have the following methods:
//
// - trackPageView(canonicalPath, previousPath): called when the URL is changed
export const createMiddleware = handlers => store => next => action => {
  const { type, payload } = action;

  if (type === LOCATION_CHANGED) {
    const previousPath = store?.getState()?.routing?.currentCanonicalPath;
    const { canonicalPath } = payload;
    handlers.forEach(handler => {
      handler.trackPageView(canonicalPath, previousPath);
    });
  }

  next(action);
};

export const pushDataLayerEvent = data => {
  console.log(data);
  
  TagManager.initialize({
    gtmId: process.env.REACT_APP_GOOGLE_ANALYTICS_ID,
    dataLayerName: data.dataLayerName,
  });

  TagManager.dataLayer(data);
};

export const getPublicProfileUrl = uuid => `${process.env.REACT_APP_MARKETPLACE_ROOT_URL}/u/${uuid}`;
