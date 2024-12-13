import { array, arrayOf, bool, func, object, oneOf, shape, string } from 'prop-types';
import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { useHistory, useLocation } from 'react-router-dom';
import { compose } from 'redux';

// Contexts
import { useConfiguration } from '../../context/configurationContext';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
// Utils
import {
  isBookingProcess,
  isPurchaseProcess,
  resolveLatestProcessName,
} from '../../transactions/transaction';
import {
  ensureListing,
  ensureOwnListing,
  ensureUser,
  userDisplayNameAsString,
} from '../../util/data';
import {
  isErrorNoViewingPermission,
  isErrorUserPendingApproval,
  isForbiddenError,
} from '../../util/errors.js';
import { FormattedMessage, intlShape, useIntl } from '../../util/reactIntl';
import { richText } from '../../util/richText';
import { types as sdkTypes } from '../../util/sdkLoader';
import { LISTING_STATE_CLOSED, LISTING_STATE_PENDING_APPROVAL, propTypes } from '../../util/types';
import {
  createSlug,
  LISTING_PAGE_DRAFT_VARIANT,
  LISTING_PAGE_PARAM_TYPE_DRAFT,
  LISTING_PAGE_PARAM_TYPE_EDIT,
  LISTING_PAGE_PENDING_APPROVAL_VARIANT,
  NO_ACCESS_PAGE_USER_PENDING_APPROVAL,
  NO_ACCESS_PAGE_VIEW_LISTINGS,
} from '../../util/urlHelpers';
import { hasPermissionToViewData, isUserAuthorized } from '../../util/userHelpers.js';

// Global ducks (for Redux actions and thunks)
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { initializeCardPaymentData } from '../../ducks/stripe.duck.js';
import { isScrollingDisabled, manageDisableScrolling } from '../../ducks/ui.duck';

// Shared components
import {
  AvatarMedium,
  H4,
  LayoutSingleColumn,
  Modal,
  NamedLink,
  NamedRedirect,
  OrderPanel,
  Page,
  ReviewRatingCustom,
} from '../../components';

// Related components and modules
import FooterContainer from '../FooterContainer/FooterContainer';
import NotFoundPage from '../NotFoundPage/NotFoundPage';
import TopbarContainer from '../TopbarContainer/TopbarContainer';

import {
  createSellerListing,
  fetchTimeSlots,
  fetchTransactionLineItems,
  getListingsOffeListingById,
  sendInquiry,
  setInitialValues,
} from './ListingPage.duck';

import ActionBarMaybe from './ActionBarMaybe';
import {
  ErrorPage,
  handleContactUser,
  handleSubmit,
  handleSubmitCheckoutPageWithInquiry,
  handleSubmitInquiry,
  listingImages,
  LoadingPage,
  priceData,
  priceForSchemaMaybe,
  handleToggleFavorites,
} from './ListingPage.shared';
import { updateProfile } from '../ProfileSettingsPage/ProfileSettingsPage.duck';
import SectionMapMaybe from './SectionMapMaybe';
import SectionTextMaybe from './SectionTextMaybe';

import { initiateInquiryWithoutPayment } from '../CheckoutPage/CheckoutPage.duck.js';
import { onSubmitCallback, STORAGE_KEY } from '../CheckoutPage/CheckoutPage.js';
import { handlePageData } from '../CheckoutPage/CheckoutPageSessionHelpers.js';
import CustomInquiryForm from './CustomInquiryForm/CustomInquiryForm.js';
import css from './ListingPage.module.css';

import moment from 'moment';
import dateSVG from '../../assets/date.svg';
import locationSVG from '../../assets/location.svg';
import { MIN_LENGTH_FOR_LONG_WORDS } from '../ProfilePage/ProfilePage.js';
import SectionGallery from './SectionGallery.js';
import SectionOfferListingsMaybe from './SectionOfferListingsMaybe.js';
import { pushDataLayerEvent } from '../../analytics/analytics.js';

const MIN_LENGTH_FOR_LONG_WORDS_IN_TITLE = 16;

const { UUID } = sdkTypes;

export const ListingPageComponent = props => {
  const [inquiryModalOpen, setInquiryModalOpen] = useState(
    props.inquiryModalOpenForListingId === props.params.id
  );

  const [customInquiryModalOpen, setCustomInquiryModalOpen] = useState(false);

  const {
    isAuthenticated,
    currentUser,
    getListing,
    getOwnListing,
    intl,
    onManageDisableScrolling,
    params: rawParams,
    location,
    scrollingDisabled,
    showListingError,
    reviews,
    fetchReviewsError,
    sendInquiryInProgress,
    sendInquiryError,
    monthlyTimeSlots,
    onFetchTimeSlots,
    onFetchTransactionLineItems,
    lineItems,
    fetchLineItemsInProgress,
    fetchLineItemsError,
    history,
    callSetInitialValues,
    onSendInquiry,
    onInitializeCardPaymentData,
    config,
    routeConfiguration,
    showOwnListingsOnly,
    onInquiryWithoutPayment,
    onCreateSellerListing,
    offerListingItems,
    onUpdateFavorites,
    userReviews,
    offerReviews,
  } = props;

  useEffect(() => {
    if (currentUser?.attributes?.email && currentUser?.attributes?.title) {
      pushDataLayerEvent({
        dataLayer: {
          email: currentUser.attributes.email,
          title: currentListing.attributes.title,
          link: window.location.href,
        },
        dataLayerName: 'Listing_PageView',
      });
    }
  }, []);

  const listingConfig = config.listing;
  const listingId = new UUID(rawParams.id);
  const isPendingApprovalVariant = rawParams.variant === LISTING_PAGE_PENDING_APPROVAL_VARIANT;
  const isDraftVariant = rawParams.variant === LISTING_PAGE_DRAFT_VARIANT;
  const currentListing =
    isPendingApprovalVariant || isDraftVariant || showOwnListingsOnly
      ? ensureOwnListing(getOwnListing(listingId))
      : ensureListing(getListing(listingId));

  const listingSlug = rawParams.slug || createSlug(currentListing.attributes.title || '');
  const params = { slug: listingSlug, ...rawParams };

  const listingPathParamType = isDraftVariant
    ? LISTING_PAGE_PARAM_TYPE_DRAFT
    : LISTING_PAGE_PARAM_TYPE_EDIT;
  const listingTab = isDraftVariant ? 'photos' : 'details';

  const isApproved =
    currentListing.id && currentListing.attributes.state !== LISTING_STATE_PENDING_APPROVAL;

  const pendingIsApproved = isPendingApprovalVariant && isApproved;

  // If a /pending-approval URL is shared, the UI requires
  // authentication and attempts to fetch the listing from own
  // listings. This will fail with 403 Forbidden if the author is
  // another user. We use this information to try to fetch the
  // public listing.
  const pendingOtherUsersListing =
    (isPendingApprovalVariant || isDraftVariant) &&
    showListingError &&
    showListingError.status === 403;
  const shouldShowPublicListingPage = pendingIsApproved || pendingOtherUsersListing;

  if (shouldShowPublicListingPage) {
    return <NamedRedirect name="ListingPage" params={params} search={location.search} />;
  }

  const topbar = <TopbarContainer />;

  if (showListingError && showListingError.status === 404) {
    // 404 listing not found
    return <NotFoundPage staticContext={props.staticContext} />;
  } else if (showListingError) {
    // Other error in fetching listing
    return <ErrorPage topbar={topbar} scrollingDisabled={scrollingDisabled} intl={intl} />;
  } else if (!currentListing.id) {
    // Still loading the listing
    return <LoadingPage topbar={topbar} scrollingDisabled={scrollingDisabled} intl={intl} />;
  }

  const {
    description = '',
    geolocation = null,
    price = null,
    title = '',
    publicData = {},
    metadata = {},
  } = currentListing.attributes;

  const richTitle = (
    <span>
      {richText(title, {
        longWordMinLength: MIN_LENGTH_FOR_LONG_WORDS_IN_TITLE,
        longWordClass: css.longWord,
      })}
    </span>
  );

  const authorAvailable = currentListing && currentListing.author;
  const userAndListingAuthorAvailable = !!(currentUser && authorAvailable);
  const isOwnListing =
    userAndListingAuthorAvailable && currentListing.author.id.uuid === currentUser.id.uuid;

  const {
    listingType,
    transactionProcessAlias,
    unitType,
    project_type,
    flex_price,
    selectedDate,
  } = publicData;

  if (!(listingType && transactionProcessAlias && unitType)) {
    // Listing should always contain listingType, transactionProcessAlias and unitType)
    return (
      <ErrorPage topbar={topbar} scrollingDisabled={scrollingDisabled} intl={intl} invalidListing />
    );
  }
  const processName = resolveLatestProcessName(transactionProcessAlias.split('/')[0]);
  const isBooking = isBookingProcess(processName);
  const isPurchase = isPurchaseProcess(processName);
  const processType = isBooking ? 'booking' : isPurchase ? 'purchase' : 'inquiry';

  const currentAuthor = authorAvailable ? currentListing.author : null;
  const ensuredAuthor = ensureUser(currentAuthor);
  const noPayoutDetailsSetWithOwnListing =
    isOwnListing && (processType !== 'inquiry' && !currentUser?.attributes?.stripeConnected);
  const payoutDetailsWarning = noPayoutDetailsSetWithOwnListing ? (
    <span className={css.payoutDetailsWarning}>
      <FormattedMessage id="ListingPage.payoutDetailsWarning" values={{ processType }} />
      <NamedLink name="StripePayoutPage">
        <FormattedMessage id="ListingPage.payoutDetailsWarningLink" />
      </NamedLink>
    </span>
  ) : null;

  // When user is banned or deleted the listing is also deleted.
  // Because listing can be never showed with banned or deleted user we don't have to provide
  // banned or deleted display names for the function
  const authorDisplayName = userDisplayNameAsString(ensuredAuthor, '');

  const { formattedPrice } = priceData(price, config.currency, intl);

  const commonParams = { params, history, routes: routeConfiguration };
  const onContactUser = handleContactUser({
    ...commonParams,
    currentUser,
    callSetInitialValues,
    location,
    setInitialValues,
    setInquiryModalOpen,
  });
  // Note: this is for inquiry state in booking and purchase processes. Inquiry process is handled through handleSubmit.
  const onSubmitInquiry = handleSubmitInquiry({
    ...commonParams,
    getListing,
    onSendInquiry,
    setInquiryModalOpen,
  });
  const onSubmit = handleSubmit({
    ...commonParams,
    currentUser,
    callSetInitialValues,
    getListing,
    onInitializeCardPaymentData,
  });

  const handleOrderSubmit = values => {
    const isCurrentlyClosed = currentListing.attributes.state === LISTING_STATE_CLOSED;
    if (isOwnListing || isCurrentlyClosed) {
      window.scrollTo(0, 0);
    } else {
      onSubmit(values);
    }
  };

  const facebookImages = listingImages(currentListing, 'facebook');
  const twitterImages = listingImages(currentListing, 'twitter');
  const schemaImages = listingImages(
    currentListing,
    `${config.layout.listingImage.variantPrefix}-2x`
  ).map(img => img.url);
  const marketplaceName = config.marketplaceName;
  const schemaTitle = intl.formatMessage(
    { id: 'ListingPage.schemaTitle' },
    { title, price: formattedPrice, marketplaceName }
  );
  // You could add reviews, sku, etc. into page schema
  // Read more about product schema
  // https://developers.google.com/search/docs/advanced/structured-data/product
  const productURL = `${config.marketplaceRootURL}${location.pathname}${location.search}${location.hash}`;
  const currentStock = currentListing.currentStock?.attributes?.quantity || 0;
  const schemaAvailability = !currentListing.currentStock
    ? null
    : currentStock > 0
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock';

  const availabilityMaybe = schemaAvailability ? { availability: schemaAvailability } : {};
  const orderData = { deliveryMethod: 'none' };
  const transaction = null;
  const initialData = { orderData, listing: currentListing, transaction };
  const pageData = handlePageData(initialData, STORAGE_KEY, history);

  const handleInquiryFormSubmit = handleSubmitCheckoutPageWithInquiry({
    ...commonParams,
    config,
    processName,
    pageData,
    onInquiryWithoutPayment,
    onSubmitCallback,
    onCreateSellerListing,
    currentUser,
    title,
  });

  const displayDate = selectedDate ? moment(selectedDate).format('dddd D MMMM, YYYY') : null;
  const descriptionWithLinks = richText(description, {
    linkify: true,
    longWordMinLength: MIN_LENGTH_FOR_LONG_WORDS,
    longWordClass: css.longWord,
  });

  const publishDate = moment(currentListing.attributes.createdAt).format('dddd D MMMM, YYYY');

  const linkProps = {
    name: 'ProfilePage',
    params: {
      id: ensuredAuthor.id.uuid
    },
  };

  const onToggleFavorites = handleToggleFavorites({
    ...commonParams,
    currentUser,
    onUpdateFavorites,
    location,
  });

  const isFavorite = currentUser?.attributes.profile.privateData.favorites?.includes(
    currentListing.id.uuid
  );

  const toggleFavorites = () => {
    console.log('toggle');

    onToggleFavorites(isFavorite);
  }

  const favoriteButton = (
    <div
      className={css.toggleFavorites}
      onClick={toggleFavorites}
    >
      {isFavorite ? (
        <>
          <svg
            width="15"
            height="14"
            viewBox="0 0 15 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8.51191 12.9998C7.94213 13.4981 7.06498 13.4981 6.49519 12.9925L6.41274 12.9203C2.47672 9.48968 -0.0947834 7.2435 0.00267716 4.44123C0.0476633 3.21342 0.699937 2.03616 1.75703 1.34281C3.73625 0.0427733 6.18032 0.649451 7.49981 2.13729C8.8193 0.649451 11.2633 0.0355599 13.2426 1.34281C14.2997 2.03616 14.9519 3.21342 14.9969 4.44123C15.1019 7.2435 12.5229 9.48968 8.58688 12.9347L8.51191 12.9998Z"
              fill="#FF4401"
            />
          </svg>
          <FormattedMessage id="ListingPage.unfavoriteButton" />
        </>
      ) : (
        <>
          <svg
            width="15"
            height="14"
            viewBox="0 0 15 14"
            fill="none" xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13.2297 1.24474C11.2524 -0.053991 8.81083 0.552077 7.49266 2.03842C6.17449 0.552077 3.73288 -0.0611971 1.75565 1.24474C0.707095 1.93739 0.0480261 3.10627 0.00308468 4.34005C-0.101758 7.13957 2.47465 9.38354 6.40668 12.8252L6.48157 12.8901C7.05076 13.3879 7.92705 13.388 8.49627 12.8829L8.57864 12.8107C12.5107 9.37628 15.0796 7.13236 14.9822 4.33284C14.9373 3.10627 14.2782 1.93739 13.2297 1.24474ZM7.56755 11.7501L7.49266 11.8222L7.41777 11.7501C3.85271 8.64033 1.50099 6.584 1.50099 4.49879C1.50099 3.05577 2.62443 1.97348 4.12236 1.97348C5.27576 1.97348 6.39917 2.68782 6.79613 3.67628H8.19667C8.58615 2.68782 9.70956 1.97348 10.863 1.97348C12.3609 1.97348 13.4843 3.05577 13.4843 4.49879C13.4843 6.584 11.1326 8.64033 7.56755 11.7501Z"
              fill="#536471"
            />
            <path
              d="M8.11344 1.7L7.49857 2.31636L6.88071 1.6985C6.1248 0.94269 5.09961 0.518123 4.03067 0.518193C2.96173 0.518263 1.9366 0.942966 1.18079 1.69887C0.424986 2.45478 0.000417979 3.47996 0.00048829 4.54891C0.000558601 5.61785 0.425261 6.64298 1.18117 7.39879L7.10116 13.3188C7.20661 13.4241 7.34954 13.4832 7.49857 13.4832C7.64761 13.4832 7.79054 13.4241 7.89599 13.3188L13.8212 7.39729C14.5762 6.64132 15.0003 5.61654 15.0001 4.54811C15 3.47969 14.5757 2.45502 13.8205 1.69925C13.4458 1.32436 13.001 1.02696 12.5114 0.824061C12.0218 0.621159 11.497 0.516724 10.967 0.516724C10.437 0.516724 9.91216 0.621159 9.42254 0.824061C8.93292 1.02696 8.48808 1.32436 8.11344 1.69925V1.7ZM13.0234 6.60395L7.49857 12.1265L1.976 6.60395C1.70383 6.33467 1.48756 6.01424 1.33963 5.6611C1.1917 5.30796 1.11503 4.92906 1.11401 4.54619C1.11299 4.16332 1.18765 3.78402 1.3337 3.43009C1.47975 3.07617 1.69431 2.7546 1.96504 2.48387C2.23577 2.21313 2.55734 1.99858 2.91126 1.85253C3.26519 1.70648 3.64449 1.63182 4.02736 1.63284C4.41023 1.63386 4.78913 1.71053 5.14227 1.85846C5.49541 2.00639 5.81584 2.22266 6.08512 2.49483L7.10341 3.51236C7.15639 3.5654 7.21944 3.60731 7.28885 3.63564C7.35826 3.66396 7.43263 3.67811 7.50759 3.67728C7.58255 3.67644 7.65659 3.66062 7.72535 3.63075C7.79411 3.60089 7.85621 3.55757 7.90799 3.50336L8.90828 2.49483C9.45964 1.98162 10.1886 1.70225 10.9417 1.71551C11.6948 1.72876 12.4135 2.03359 12.9464 2.56588C13.4794 3.09817 13.7852 3.81642 13.7994 4.56954C13.8136 5.32266 13.5352 6.05193 13.0227 6.60395H13.0234Z"
              fill="#536471"
            />
          </svg>
          <FormattedMessage id="ListingPage.favoriteButton" />
        </>
      )}
    </div>
  );

  const calculateAvgRating = uReviews => {
    const totalRating = uReviews.reduce((sum, review) => sum + review.attributes.rating, 0);

    return totalRating / uReviews.length;
  }

  return (
    <Page
      title={schemaTitle}
      scrollingDisabled={scrollingDisabled}
      author={authorDisplayName}
      description={description}
      facebookImages={facebookImages}
      twitterImages={twitterImages}
      className={css.pageWrapper}
      socialSharing={{
        title: intl.formatMessage({
          id: 'ListingPage.ogTitle',
        }, {
          title,
        }),
        description: intl.formatMessage({
          id: 'ListingPage.ogDescription',
        }, {
          title,
        }),
        images1200: [{
          width: 1280,
          height: 720,
          url: 'https://cdn.prod.website-files.com/67388105e786c44d2fd25e83/6752e663a4801698954d151d_italiawork-social-sharing.jpg',
        }],
      }}
      schema={{
        '@context': 'http://schema.org',
        '@type': 'Product',
        description: description,
        name: schemaTitle,
        image: schemaImages,
        offers: {
          '@type': 'Offer',
          url: productURL,
          ...priceForSchemaMaybe(price, intl),
          ...availabilityMaybe,
        },
      }}
    >
      <LayoutSingleColumn className={css.pageRoot} topbar={topbar} footer={<FooterContainer />}>
        <div className={css.container}>
          <div className={css.containerInner}>
            {currentListing.id && noPayoutDetailsSetWithOwnListing ? (
              <ActionBarMaybe
                className={css.actionBarForProductLayout}
                isOwnListing={isOwnListing}
                listing={currentListing}
                showNoPayoutDetailsSet={noPayoutDetailsSetWithOwnListing}
                currentUser={currentUser}
              />
            ) : null}
            {currentListing.id ? (
              <ActionBarMaybe
                className={css.actionBarForProductLayout}
                isOwnListing={isOwnListing}
                listing={currentListing}
                currentUser={currentUser}
                editParams={{
                  id: listingId.uuid,
                  slug: listingSlug,
                  type: listingPathParamType,
                  tab: listingTab,
                }}
              />
            ) : null}
            <div className={css.contentWrapperForProductLayout}>
              <div className={css.mainColumnForProductLayout}>

                {/* <div className={css.mobileHeading}>
                  <H4 as="h1" className={css.orderPanelTitle}>
                    <FormattedMessage id="ListingPage.orderTitle" values={{ title: richTitle }} />
                  </H4>
                </div> */}
                {favoriteButton}
                <SectionTextMaybe text={title} showAsIngress />
                <div className={css.date}>
                  <span className={css.dateLabel}>
                    <FormattedMessage id="ListingPage.ListingPageCarousel.publishDate" />
                  </span>
                  <span> {publishDate}</span>
                </div>
                {/* <SectionTextMaybe text={description} showAsIngress /> */}

                <NamedLink
                  className={css.authorNameLink}
                  {...linkProps}
                >
                  <div className={css.author}>
                    <AvatarMedium
                      user={ensuredAuthor}
                      className={css.providerAvatar}
                      disableProfileLink={true}
                    />
                    <div>
                      <span className={css.providerNameLinked}>
                        <FormattedMessage
                          id="OrderPanel.author"
                          values={{
                            name: authorDisplayName
                          }}
                        />
                      </span>
                      {!!userReviews.length && (
                        <ReviewRatingCustom
                          rating={calculateAvgRating(userReviews)}
                          reviews={userReviews.length}
                        />
                      )}
                    </div>
                  </div>
                </NamedLink>

                {/* <CustomListingFields
                  publicData={publicData}
                  metadata={metadata}
                  listingFieldConfigs={listingConfig.listingFields}
                  categoryConfiguration={config.categoryConfiguration}
                  intl={intl}
                /> */}

                {!!currentListing.attributes.publicData?.location?.address && (
                  <div className={css.projectTypeContent}>
                    <div>
                      <img src={locationSVG} />
                    </div>
                    <div>
                      <div className={css.projectTypeTopic}>
                        <FormattedMessage id="ListingPage.ListingPageCarousel.working" />
                      </div>
                      <div className={css.projectTypeTitle}>{currentListing.attributes.publicData.location.address.replace(/, Italia$/, '')}</div>
                    </div>
                  </div>
                )}

                {displayDate ? (
                  <div className={css.projectTypeContent}>
                    <div>
                      <img src={dateSVG} />
                    </div>
                    <div>
                      <div className={css.projectTypeTopic}>
                        <FormattedMessage id="ListingPage.ListingPageCarousel.date" />
                      </div>
                      <div className={`${css.projectTypeTitle} ${css.capitalize}`}>{displayDate}</div>
                    </div>
                  </div>
                ) : null}

                <OrderPanel
                  className={`${css.productOrderPanel} ${css.mobileOnly}`}
                  listing={currentListing}
                  currentUser={currentUser}
                  routes={routeConfiguration}
                  isOwnListing={isOwnListing}
                  onSubmit={handleOrderSubmit}
                  authorLink={
                    <NamedLink
                      className={css.authorNameLink}
                      name="ListingPage"
                      params={params}
                      to={{ hash: '#author' }}
                    >
                      {authorDisplayName}
                    </NamedLink>
                  }
                  title={<FormattedMessage id="ListingPage.orderTitle" values={{ title: richTitle }} />}
                  titleDesktop={
                    <H4 as="h1" className={css.orderPanelTitle}>
                      <FormattedMessage id="ListingPage.orderTitle" values={{ title: richTitle }} />
                    </H4>
                  }
                  payoutDetailsWarning={payoutDetailsWarning}
                  author={ensuredAuthor}
                  onManageDisableScrolling={onManageDisableScrolling}
                  onContactUser={onContactUser}
                  monthlyTimeSlots={monthlyTimeSlots}
                  onFetchTimeSlots={onFetchTimeSlots}
                  onFetchTransactionLineItems={onFetchTransactionLineItems}
                  lineItems={lineItems}
                  fetchLineItemsInProgress={fetchLineItemsInProgress}
                  fetchLineItemsError={fetchLineItemsError}
                  validListingTypes={config.listing.listingTypes}
                  marketplaceCurrency={config.currency}
                  dayCountAvailableForBooking={config.stripe.dayCountAvailableForBooking}
                  marketplaceName={config.marketplaceName}
                  setInquiryModalOpen={setCustomInquiryModalOpen}
                />

                {project_type && project_type !== 'online' ? (
                  <SectionMapMaybe
                    geolocation={geolocation}
                    publicData={publicData}
                    listingId={currentListing.id}
                    mapsConfig={config.maps}
                  />
                ) : null}

                <div className={css.marginContent}>
                  <H4>
                    <FormattedMessage id="ListingPage.ListingPageCarousel.detailsTitle" />
                  </H4>
                  <p className={css.bio}>{descriptionWithLinks}</p>
                </div>

                <SectionGallery
                  listing={currentListing}
                  variantPrefix={config.layout.listingImage.variantPrefix}
                />

                {/* <SectionReviews reviews={reviews} fetchReviewsError={fetchReviewsError} /> */}
                {/* <SectionAuthorMaybe
                  title={title}
                  listing={currentListing}
                  authorDisplayName={authorDisplayName}
                  onContactUser={onContactUser}
                  isInquiryModalOpen={isAuthenticated && inquiryModalOpen}
                  onCloseInquiryModal={() => setInquiryModalOpen(false)}
                  sendInquiryError={sendInquiryError}
                  sendInquiryInProgress={sendInquiryInProgress}
                  onSubmitInquiry={onSubmitInquiry}
                  currentUser={currentUser}
                  onManageDisableScrolling={onManageDisableScrolling}
                /> */}

                <SectionOfferListingsMaybe
                  listings={offerListingItems}
                  intl={intl}
                  onInitializeCardPaymentData={onInitializeCardPaymentData}
                  currentUser={currentUser}
                  callSetInitialValues={callSetInitialValues}
                  getListing={getListing}
                  isOwnListing={isOwnListing}
                  offerReviews={offerReviews}
                  calculateAvgRating={calculateAvgRating}
                />
              </div>
              <div className={css.orderColumnForProductLayout}>
                <OrderPanel
                  className={`${css.productOrderPanel} ${css.desktopOnly}`}
                  listing={currentListing}
                  currentUser={currentUser}
                  routes={routeConfiguration}
                  isOwnListing={isOwnListing}
                  onSubmit={handleOrderSubmit}
                  authorLink={
                    <NamedLink
                      className={css.authorNameLink}
                      name="ListingPage"
                      params={params}
                      to={{ hash: '#author' }}
                    >
                      {authorDisplayName}
                    </NamedLink>
                  }
                  title={<FormattedMessage id="ListingPage.orderTitle" values={{ title: richTitle }} />}
                  titleDesktop={
                    <H4 as="h1" className={css.orderPanelTitle}>
                      <FormattedMessage id="ListingPage.orderTitle" values={{ title: richTitle }} />
                    </H4>
                  }
                  payoutDetailsWarning={payoutDetailsWarning}
                  author={ensuredAuthor}
                  onManageDisableScrolling={onManageDisableScrolling}
                  onContactUser={onContactUser}
                  monthlyTimeSlots={monthlyTimeSlots}
                  onFetchTimeSlots={onFetchTimeSlots}
                  onFetchTransactionLineItems={onFetchTransactionLineItems}
                  lineItems={lineItems}
                  fetchLineItemsInProgress={fetchLineItemsInProgress}
                  fetchLineItemsError={fetchLineItemsError}
                  validListingTypes={config.listing.listingTypes}
                  marketplaceCurrency={config.currency}
                  dayCountAvailableForBooking={config.stripe.dayCountAvailableForBooking}
                  marketplaceName={config.marketplaceName}
                  setInquiryModalOpen={setCustomInquiryModalOpen}
                />
              </div>
              <Modal
                id="ListingPage.inquiry"
                contentClassName={css.inquiryModalContent}
                isOpen={isAuthenticated && customInquiryModalOpen}
                onClose={() => setCustomInquiryModalOpen(false)}
                usePortal
                onManageDisableScrolling={onManageDisableScrolling}
              >
                <CustomInquiryForm
                  className={css.inquiryForm}
                  submitButtonWrapperClassName={css.inquirySubmitButtonWrapper}
                  listingTitle={title}
                  authorDisplayName={authorDisplayName}
                  sendInquiryError={sendInquiryError}
                  onSubmit={handleInquiryFormSubmit}
                  inProgress={sendInquiryInProgress}
                  marketplaceCurrency={config.currency}
                  offerPrice={price}
                  flex_price={Array.isArray(flex_price) && flex_price.length > 0}
                  listing={currentListing}
                />
              </Modal>
            </div>
          </div>

          {/* <SectionReviews reviews={reviews} fetchReviewsError={fetchReviewsError} /> */}
          {/* <SectionAuthorMaybe
              title={title}
              listing={currentListing}
              authorDisplayName={authorDisplayName}
              onContactUser={onContactUser}
              isInquiryModalOpen={isAuthenticated && inquiryModalOpen}
              onCloseInquiryModal={() => setInquiryModalOpen(false)}
              sendInquiryError={sendInquiryError}
              sendInquiryInProgress={sendInquiryInProgress}
              onSubmitInquiry={onSubmitInquiry}
              currentUser={currentUser}
              onManageDisableScrolling={onManageDisableScrolling}
            /> */}
        </div>
        <Modal
          id="ListingPage.inquiry"
          contentClassName={css.inquiryModalContent}
          isOpen={isAuthenticated && customInquiryModalOpen}
          onClose={() => setCustomInquiryModalOpen(false)}
          usePortal
          onManageDisableScrolling={onManageDisableScrolling}
        >
          <CustomInquiryForm
            className={css.inquiryForm}
            submitButtonWrapperClassName={css.inquirySubmitButtonWrapper}
            listingTitle={title}
            authorDisplayName={authorDisplayName}
            sendInquiryError={sendInquiryError}
            onSubmit={handleInquiryFormSubmit}
            inProgress={sendInquiryInProgress}
            marketplaceCurrency={config.currency}
            offerPrice={price}
            flex_price={Array.isArray(flex_price) && flex_price.length > 0}
            listing={currentListing}
          />
        </Modal>
      </LayoutSingleColumn >
    </Page >
  );
};

ListingPageComponent.defaultProps = {
  currentUser: null,
  inquiryModalOpenForListingId: null,
  showListingError: null,
  reviews: [],
  userReviews: [],
  offerReviews: {},
  fetchReviewsError: null,
  monthlyTimeSlots: null,
  sendInquiryError: null,
  lineItems: null,
  fetchLineItemsError: null,
};

ListingPageComponent.propTypes = {
  // from useHistory
  history: shape({
    push: func.isRequired,
  }).isRequired,
  // from useLocation
  location: shape({
    search: string,
  }).isRequired,

  // from useIntl
  intl: intlShape.isRequired,

  // from useConfiguration
  config: object.isRequired,
  // from useRouteConfiguration
  routeConfiguration: arrayOf(propTypes.route).isRequired,

  params: shape({
    id: string.isRequired,
    slug: string,
    variant: oneOf([LISTING_PAGE_DRAFT_VARIANT, LISTING_PAGE_PENDING_APPROVAL_VARIANT]),
  }).isRequired,

  isAuthenticated: bool.isRequired,
  currentUser: propTypes.currentUser,
  getListing: func.isRequired,
  getOwnListing: func.isRequired,
  onManageDisableScrolling: func.isRequired,
  scrollingDisabled: bool.isRequired,
  inquiryModalOpenForListingId: string,
  showListingError: propTypes.error,
  callSetInitialValues: func.isRequired,
  reviews: arrayOf(propTypes.review),
  userReviews: arrayOf(propTypes.review),
  fetchReviewsError: propTypes.error,
  monthlyTimeSlots: object,
  // monthlyTimeSlots could be something like:
  // monthlyTimeSlots: {
  //   '2019-11': {
  //     timeSlots: [],
  //     fetchTimeSlotsInProgress: false,
  //     fetchTimeSlotsError: null,
  //   }
  // }
  sendInquiryInProgress: bool.isRequired,
  sendInquiryError: propTypes.error,
  onSendInquiry: func.isRequired,
  onInitializeCardPaymentData: func.isRequired,
  onFetchTransactionLineItems: func.isRequired,
  lineItems: array,
  fetchLineItemsInProgress: bool.isRequired,
  fetchLineItemsError: propTypes.error,
};

const EnhancedListingPage = props => {
  const config = useConfiguration();
  const routeConfiguration = useRouteConfiguration();
  const intl = useIntl();
  const history = useHistory();
  const location = useLocation();

  const showListingError = props.showListingError;
  const isVariant = props.params?.variant?.length > 0;
  const currentUser = props.currentUser;
  if (isForbiddenError(showListingError) && !isVariant && !currentUser) {
    // This can happen if private marketplace mode is active
    return (
      <NamedRedirect
        name="SignupPage"
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  const isPrivateMarketplace = config.accessControl.marketplace.private === true;
  const isUnauthorizedUser = currentUser && !isUserAuthorized(currentUser);
  const hasNoViewingRights = currentUser && !hasPermissionToViewData(currentUser);
  const hasUserPendingApprovalError = isErrorUserPendingApproval(showListingError);

  if ((isPrivateMarketplace && isUnauthorizedUser) || hasUserPendingApprovalError) {
    return (
      <NamedRedirect
        name="NoAccessPage"
        params={{ missingAccessRight: NO_ACCESS_PAGE_USER_PENDING_APPROVAL }}
      />
    );
  } else if (
    (hasNoViewingRights && isForbiddenError(showListingError)) ||
    isErrorNoViewingPermission(showListingError)
  ) {
    // If the user has no viewing rights, fetching anything but their own listings
    // will return a 403 error. If that happens, redirect to NoAccessPage.
    return (
      <NamedRedirect
        name="NoAccessPage"
        params={{ missingAccessRight: NO_ACCESS_PAGE_VIEW_LISTINGS }}
      />
    );
  }

  return (
    <ListingPageComponent
      config={config}
      routeConfiguration={routeConfiguration}
      intl={intl}
      history={history}
      location={location}
      showOwnListingsOnly={hasNoViewingRights}
      {...props}
    />
  );
};

const mapStateToProps = state => {
  const { isAuthenticated } = state.auth;
  const {
    showListingError,
    reviews,
    userReviews,
    fetchReviewsError,
    monthlyTimeSlots,
    sendInquiryInProgress,
    sendInquiryError,
    lineItems,
    fetchLineItemsInProgress,
    fetchLineItemsError,
    inquiryModalOpenForListingId,
    offerListingItems: stateOfferListingItems,
    listingOfferEntities,
    id: listingId,
    offerReviews,
  } = state.ListingPage;

  const { currentUser } = state.user;

  const offerListingItems =
    stateOfferListingItems && listingOfferEntities
      ? getListingsOffeListingById(listingOfferEntities, stateOfferListingItems)
      : null;



  const getListing = id => {
    const ref = { id, type: 'listing' };
    const listings = getMarketplaceEntities(state, [ref]);
    return listings.length === 1 ? listings[0] : null;
  };

  const getOwnListing = id => {
    const ref = { id, type: 'ownListing' };
    const listings = getMarketplaceEntities(state, [ref]);
    return listings.length === 1 ? listings[0] : null;
  };

  return {
    isAuthenticated,
    currentUser,
    getListing,
    getOwnListing,
    scrollingDisabled: isScrollingDisabled(state),
    inquiryModalOpenForListingId,
    showListingError,
    reviews,
    userReviews,
    offerReviews,
    fetchReviewsError,
    monthlyTimeSlots,
    lineItems,
    fetchLineItemsInProgress,
    fetchLineItemsError,
    sendInquiryInProgress,
    sendInquiryError,
    offerListingItems,
  };
};

const mapDispatchToProps = dispatch => ({
  onManageDisableScrolling: (componentId, disableScrolling) =>
    dispatch(manageDisableScrolling(componentId, disableScrolling)),
  callSetInitialValues: (setInitialValues, values, saveToSessionStorage) =>
    dispatch(setInitialValues(values, saveToSessionStorage)),
  onFetchTransactionLineItems: params => dispatch(fetchTransactionLineItems(params)),
  onSendInquiry: (listing, message) => dispatch(sendInquiry(listing, message)),
  onInitializeCardPaymentData: () => dispatch(initializeCardPaymentData()),
  onFetchTimeSlots: (listingId, start, end, timeZone) =>
    dispatch(fetchTimeSlots(listingId, start, end, timeZone)),
  onInquiryWithoutPayment: (params, processAlias, transitionName) =>
    dispatch(initiateInquiryWithoutPayment(params, processAlias, transitionName)),
  onCreateSellerListing: (createParams, queryParams) =>
    dispatch(createSellerListing(createParams, queryParams)),
  onUpdateFavorites: (payload) => dispatch(updateProfile(payload)),
});

// Note: it is important that the withRouter HOC is **outside** the
// connect HOC, otherwise React Router won't rerender any Route
// components since connect implements a shouldComponentUpdate
// lifecycle hook.
//
// See: https://github.com/ReactTraining/react-router/issues/4671
const ListingPage = compose(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )
)(EnhancedListingPage);

export default ListingPage;