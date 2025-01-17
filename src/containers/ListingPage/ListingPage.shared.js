import React from 'react';
import { convertMoneyToNumber, formatMoney } from '../../util/currency';
import { timestampToDate } from '../../util/dates';
import { FormattedMessage } from '../../util/reactIntl';
import { createResourceLocatorString, findRouteByRouteName } from '../../util/routes';
import { types as sdkTypes } from '../../util/sdkLoader';
import {
  NO_ACCESS_PAGE_INITIATE_TRANSACTIONS,
  NO_ACCESS_PAGE_USER_PENDING_APPROVAL,
  createSlug,
} from '../../util/urlHelpers';
import { hasPermissionToInitiateTransactions, isUserAuthorized } from '../../util/userHelpers';

import { LayoutSingleColumn, Page } from '../../components';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';

import { getProcess } from '../../transactions/transaction';
import { getTransactionTypeData } from '../CheckoutPage/CheckoutPageTransactionHelpers';
import { pushDataLayerEvent } from '../../analytics/analytics';
import css from './ListingPage.module.css';
const { types } = require('sharetribe-flex-sdk');
const { Money } = types;

/**
 * This file contains shared functions from each ListingPage variants.
 */

const { UUID } = sdkTypes;

/**
 * Helper to get formattedPrice and priceTitle for SectionHeading component.
 * @param {Money} price listing's price
 * @param {String} marketplaceCurrency currency of the price (e.g. 'USD')
 * @param {Object} intl React Intl instance
 * @returns Object literal containing formattedPrice and priceTitle
 */
export const priceData = (price, marketplaceCurrency, intl) => {
  if (price && price.currency === marketplaceCurrency) {
    const formattedPrice = formatMoney(intl, price);
    return { formattedPrice, priceTitle: formattedPrice };
  } else if (price) {
    return {
      formattedPrice: `(${price.currency})`,
      priceTitle: `Unsupported currency (${price.currency})`,
    };
  }
  return {};
};

/**
 * Converts Money object to number, which is needed for the search schema (for Google etc.)
 *
 * @param {Money} price
 * @returns {Money|null}
 */
export const priceForSchemaMaybe = (price, intl) => {
  try {
    const schemaPrice = convertMoneyToNumber(price);
    return schemaPrice
      ? {
        price: intl.formatNumber(schemaPrice, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        priceCurrency: price.currency,
      }
      : {};
  } catch (e) {
    return {};
  }
};

/**
 * Get category's label.
 *
 * @param {Array} categories array of category objects (key & label)
 * @param {String} value selected category value
 * @returns label for the selected value
 */
export const categoryLabel = (categories, value) => {
  const cat = categories.find(c => c.key === value);
  return cat ? cat.label : value;
};

/**
 * Filter listing images with correct custom image variant name.
 * Used for facebook, twitter and page schema images.
 *
 * @param {Listing} listing
 * @param {String} variantName
 * @returns correct image variant specified by variantName parameter.
 */
export const listingImages = (listing, variantName) =>
  (listing.images || [])
    .map(image => {
      const variants = image.attributes.variants;
      const variant = variants ? variants[variantName] : null;

      // deprecated
      // for backwards combatility only
      const sizes = image.attributes.sizes;
      const size = sizes ? sizes.find(i => i.name === variantName) : null;

      return variant || size;
    })
    .filter(variant => variant != null);

/**
 * Callback for the "contact" button on ListingPage to open inquiry modal.
 *
 * @param {Object} parameters all the info needed to open inquiry modal.
 */
export const handleContactUser = parameters => () => {
  const {
    history,
    params,
    currentUser,
    callSetInitialValues,
    location,
    routes,
    setInitialValues,
    setInquiryModalOpen,
  } = parameters;

  if (!currentUser) {
    const state = { from: `${location.pathname}${location.search}${location.hash}` };

    // We need to log in before showing the modal, but first we need to ensure
    // that modal does open when user is redirected back to this listingpage
    callSetInitialValues(setInitialValues, { inquiryModalOpenForListingId: params.id });

    // signup and return back to listingPage.
    history.push(createResourceLocatorString('SignupPage', routes, {}, {}), state);
  } else if (!isUserAuthorized(currentUser)) {
    // A user in pending-approval state can't contact the author (the same applies for a banned user)
    const pathParams = { missingAccessRight: NO_ACCESS_PAGE_USER_PENDING_APPROVAL };
    history.push(createResourceLocatorString('NoAccessPage', routes, pathParams, {}));
  } else if (!hasPermissionToInitiateTransactions(currentUser)) {
    // A user in pending-approval state can't contact the author (the same applies for a banned user)
    const pathParams = { missingAccessRight: NO_ACCESS_PAGE_INITIATE_TRANSACTIONS };
    history.push(createResourceLocatorString('NoAccessPage', routes, pathParams, {}));
  } else {
    setInquiryModalOpen(true);
  }
};

/**
 * Callback for the inquiry modal to submit aka create inquiry transaction on ListingPage.
 * Note: this is for booking and purchase processes. Inquiry process is handled through handleSubmit.
 *
 * @param {Object} parameters all the info needed to create inquiry.
 */
export const handleSubmitInquiry = parameters => values => {
  const { history, params, getListing, onSendInquiry, routes, setInquiryModalOpen } = parameters;

  const listingId = new UUID(params.id);
  const listing = getListing(listingId);
  const { message } = values;

  onSendInquiry(listing, message.trim())
    .then(txId => {
      setInquiryModalOpen(false);

      // Redirect to OrderDetailsPage
      history.push(createResourceLocatorString('OrderDetailsPage', routes, { id: txId.uuid }, {}));
    })
    .catch(() => {
      // Ignore, error handling in duck file
    });
};

/**
 * Handle order submit from OrderPanel.
 *
 * @param {Object} parameters all the info needed to redirect user to CheckoutPage.
 */
export const handleSubmit = parameters => values => {
  const {
    history,
    params,
    currentUser,
    getListing,
    callSetInitialValues,
    onInitializeCardPaymentData,
    routes,
  } = parameters;

  const listingId = new UUID(params.id);
  const listing = getListing(listingId);

  const {
    bookingDates,
    bookingStartTime,
    bookingEndTime,
    bookingStartDate, // not relevant (omit)
    bookingEndDate, // not relevant (omit)
    quantity: quantityRaw,
    seats: seatsRaw,
    deliveryMethod,
    ...otherOrderData
  } = values;

  const bookingMaybe = bookingDates
    ? {
      bookingDates: {
        bookingStart: bookingDates.startDate,
        bookingEnd: bookingDates.endDate,
      },
    }
    : bookingStartTime && bookingEndTime
      ? {
        bookingDates: {
          bookingStart: timestampToDate(bookingStartTime),
          bookingEnd: timestampToDate(bookingEndTime),
        },
      }
      : {};
  const quantity = Number.parseInt(quantityRaw, 10);
  const quantityMaybe = Number.isInteger(quantity) ? { quantity } : {};
  const seats = Number.parseInt(seatsRaw, 10);
  const seatsMaybe = Number.isInteger(seats) ? { seats } : {};
  const deliveryMethodMaybe = deliveryMethod ? { deliveryMethod } : {};

  const initialValues = {
    listing,
    orderData: {
      ...bookingMaybe,
      ...quantityMaybe,
      ...seatsMaybe,
      ...deliveryMethodMaybe,
      ...otherOrderData,
    },
    confirmPaymentError: null,
  };

  const saveToSessionStorage = !currentUser;

  // Customize checkout page state with current listing and selected orderData
  const { setInitialValues } = findRouteByRouteName('CheckoutPage', routes);

  callSetInitialValues(setInitialValues, initialValues, saveToSessionStorage);

  // Clear previous Stripe errors from store if there is any
  onInitializeCardPaymentData();
  // Redirect to CheckoutPage
  history.push(
    createResourceLocatorString(
      'CheckoutPage',
      routes,
      { id: listing.id.uuid, slug: createSlug(listing.attributes.title) },
      {}
    )
  );
};

/**
 * Create fallback views for the ListingPage: LoadingPage and ErrorPage.
 * The PlainPage is just a helper for them.
 */
const PlainPage = props => {
  const { title, topbar, scrollingDisabled, children } = props;
  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn topbar={topbar} footer={<FooterContainer />}>
        {children}
      </LayoutSingleColumn>
    </Page>
  );
};

export const ErrorPage = props => {
  const { topbar, scrollingDisabled, invalidListing, intl } = props;
  return (
    <PlainPage
      title={intl.formatMessage({
        id: 'ListingPage.errorLoadingListingTitle',
      })}
      topbar={topbar}
      scrollingDisabled={scrollingDisabled}
    >
      <p className={css.errorText}>
        {invalidListing ? (
          <FormattedMessage id="ListingPage.errorInvalidListingMessage" />
        ) : (
          <FormattedMessage id="ListingPage.errorLoadingListingMessage" />
        )}
      </p>
    </PlainPage>
  );
};

export const LoadingPage = props => {
  const { topbar, scrollingDisabled, intl } = props;
  return (
    <PlainPage
      title={intl.formatMessage({
        id: 'ListingPage.loadingListingTitle',
      })}
      topbar={topbar}
      scrollingDisabled={scrollingDisabled}
    >
      <p className={css.loadingText}>
        <FormattedMessage id="ListingPage.loadingListingMessage" />
      </p>
    </PlainPage>
  );
};

export const handleSubmitCheckoutPageWithInquiry = props => values => {
  const {
    history,
    config,
    routes,
    pageData,
    processName,
    onInquiryWithoutPayment,
    onSubmitCallback,
    onCreateSellerListing,
    currentUser,
    title,
  } = props;

  const { message, offerPrice } = values;
  const { listingType, transactionProcessAlias, unitType, location } =
    pageData?.listing?.attributes?.publicData || {};

  const process = processName ? getProcess(processName) : null;
  const transitions = process.transitions;
  const transition = transitions.INQUIRE_WITHOUT_PAYMENT;

  // These are the inquiry parameters for the (one and only) transition
  const inquiryParams = {
    listingId: pageData?.listing?.id,
    protectedData: {
      inquiryMessage: message,
      offerPrice: {
        currency: offerPrice.currency,
        amount: offerPrice.amount,
      },
      ...getTransactionTypeData(listingType, unitType, config),
    },
  };

  pushDataLayerEvent({
    dataLayer: {
      email: currentUser.attributes.email,
      link: window.location.href,
      title,
    },
    dataLayerName: 'Listing_OfferSubmit',
  });

  // This makes a single transition directly to the API endpoint
  // (unlike in the payment-related processes, where call is proxied through the server to make privileged transition)
  onInquiryWithoutPayment(inquiryParams, transactionProcessAlias, transition)
    .then(async transactionId => {
      // setSubmitting(false);
      onSubmitCallback();
      const { title, geolocation } = pageData?.listing.attributes || {};
      let createParams = {
        title: title,
        description: message,
        price: new Money(offerPrice.amount, offerPrice.currency),
        availabilityPlan: {
          entries: [],
          timezone: 'Etc/UTC',
          type: 'availability-plan/time',
        },
        publicData: {
          isOffer: true,
          transactionProcessAlias: 'default-purchase/release-1',
          listingType: 'booking',
          unitType: 'item',
          linkedListing: pageData?.listing?.id.uuid,
        },
      };
      if (geolocation) createParams.geolocation = geolocation;
      const queryParams = {
        expand: true,
        include: ['author', 'images', 'currentStock'],
      };
      await onCreateSellerListing(createParams, queryParams);

      // Navigate to the current path
      history.push(history.location.pathname);
      // Force a reload
      window.location.reload();
    })
    .catch(err => {
      console.error(err);
      // setSubmitting(false);
    });
};

export const handleCustomSubmit = parameters => values => {
  const {
    history,
    params,
    currentUser,
    callSetInitialValues,
    onInitializeCardPaymentData,
    routes,
    listing,
  } = parameters;

  const listingId = new UUID(params.id);
  const {
    bookingDates,
    bookingStartTime,
    bookingEndTime,
    bookingStartDate, // not relevant (omit)
    bookingEndDate, // not relevant (omit)
    quantity: quantityRaw,
    deliveryMethod,
    ...otherOrderData
  } = values;

  const bookingMaybe = bookingDates
    ? {
      bookingDates: {
        bookingStart: bookingDates.startDate,
        bookingEnd: bookingDates.endDate,
      },
    }
    : bookingStartTime && bookingEndTime
      ? {
        bookingDates: {
          bookingStart: timestampToDate(bookingStartTime),
          bookingEnd: timestampToDate(bookingEndTime),
        },
      }
      : {};
  const quantity = Number.parseInt(quantityRaw, 10);
  const quantityMaybe = Number.isInteger(quantity) ? { quantity } : {};
  const deliveryMethodMaybe = deliveryMethod ? { deliveryMethod } : {};

  const initialValues = {
    listing,
    orderData: {
      ...bookingMaybe,
      ...quantityMaybe,
      ...deliveryMethodMaybe,
      ...otherOrderData,
    },
    confirmPaymentError: null,
  };
  const saveToSessionStorage = !currentUser;

  // Customize checkout page state with current listing and selected orderData
  const { setInitialValues } = findRouteByRouteName('CheckoutPage', routes);

  callSetInitialValues(setInitialValues, initialValues, saveToSessionStorage);

  // Clear previous Stripe errors from store if there is any
  onInitializeCardPaymentData();

  pushDataLayerEvent({
    dataLayer: {
      email: currentUser.attributes.email,
    },
    dataLayerName: 'Listing_Checkout',
  });

  // Redirect to CheckoutPage
  history.push(
    createResourceLocatorString(
      'CheckoutPage',
      routes,
      { id: listing.id.uuid, slug: createSlug(listing.attributes.title) },
      {}
    )
  );
};

export const handleToggleFavorites = parameters => isFavorite => {
  const { currentUser, routes, location, history } = parameters;

  if (!currentUser) {
    const state = {
      from: `${location.pathname}${location.search}${location.hash}`,
    };

    history.push(createResourceLocatorString('SignupPage', routes, {}, {}), state);
  } else {
    const { params, onUpdateFavorites } = parameters;

    const {
      attributes: { profile },
    } = currentUser;

    const { favorites = [] } = profile.privateData || {};

    let payload;

    if (!profile.privateData || !profile.privateData?.favorites) {
      payload = {
        privateData: {
          favorites: [params.id],
        },
      };
    } else if (isFavorite) {
      payload = {
        privateData: {
          favorites: favorites.filter(f => f !== params.id),
        },
      };
    } else {
      payload = {
        privateData: {
          favorites: [...favorites, params.id],
        },
      };
    }

    onUpdateFavorites(payload);
  }
}

export const handleUpdateOffer = props => async values => {
  const { onUpdateOffer } = props;
  const { offerPrice, message, offerId } = values;
  const updateValue = {
    price: offerPrice,
    description: message,
    id: new UUID(offerId),
  };

  await onUpdateOffer(updateValue);
};
