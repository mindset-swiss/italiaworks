import classNames from 'classnames';
import { arrayOf, bool, oneOfType } from 'prop-types';
import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';

import { useConfiguration } from '../../context/configurationContext';
import {
  isErrorNoViewingPermission,
  isErrorUserPendingApproval,
  isForbiddenError,
  isNotFoundError,
} from '../../util/errors';
import { pickCustomFieldProps } from '../../util/fieldHelpers';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { richText } from '../../util/richText';
import {
  propTypes,
  REVIEW_TYPE_OF_CUSTOMER,
  REVIEW_TYPE_OF_PROVIDER,
  SCHEMA_TYPE_MULTI_ENUM,
  SCHEMA_TYPE_TEXT,
  SCHEMA_TYPE_YOUTUBE,
} from '../../util/types';
import {
  NO_ACCESS_PAGE_USER_PENDING_APPROVAL,
  NO_ACCESS_PAGE_VIEW_LISTINGS,
  PROFILE_PAGE_PENDING_APPROVAL_VARIANT,
} from '../../util/urlHelpers';
import { hasPermissionToViewData, isUserAuthorized } from '../../util/userHelpers';

import {
  AvatarLarge,
  ButtonTabNavHorizontal,
  H2,
  H4,
  Heading,
  ImageFromS3,
  LayoutSideNavigation,
  ListingCard,
  NamedLink,
  NamedRedirect,
  Page,
  ReviewRating,
  Reviews,
} from '../../components';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { isScrollingDisabled, manageDisableScrolling } from '../../ducks/ui.duck';

import FooterContainer from '../../containers/FooterContainer/FooterContainer';
import NotFoundPage from '../../containers/NotFoundPage/NotFoundPage';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';

import _ from 'lodash';
import moment from 'moment';
import certifiticationPNG from '../../assets/certificates.png';
import paymentVerifiedPNG from '../../assets/payment-verified.png';
import profileVerifiedPNG from '../../assets/profile-verified.png';
import topUserPNG from '../../assets/top-user.png';
import {
  checkFileType,
  FILE_DOCUMENT_TYPES,
  PreviewLink,
} from '../../components/FieldDropzone/FieldDropzone';
import CustomReviewModal from './CustomReviewModal/CustomReviewModal';
import { addUserReview } from './ProfilePage.duck';
import css from './ProfilePage.module.css';
import SectionDetailsMaybe from './SectionDetailsMaybe';
import SectionMultiEnumMaybe from './SectionMultiEnumMaybe';
import SectionTextMaybe from './SectionTextMaybe';
import SectionYoutubeVideoMaybe from './SectionYoutubeVideoMaybe';

import Share from '../../components/Share/Share';

const MAX_MOBILE_SCREEN_WIDTH = 768;
export const MIN_LENGTH_FOR_LONG_WORDS = 20;

export const AsideContent = props => {
  const intl = useIntl();
  const { user, displayName, showLinkToProfileSettingsPage, publicData } = props;
  const { stripeAccount } = user||{};
  const { certifications, top_user_badge } = publicData || {};

  return (
    <div className={css.asideContent}>
      <AvatarLarge className={css.avatar} user={user} disableProfileLink />
      <div className={css.displayFlexDesktop}>
        {stripeAccount ? <img src={paymentVerifiedPNG} height={20} width={20} /> : null}
        {stripeAccount ? <img src={profileVerifiedPNG} height={20} width={20} /> : null}
        {certifications && Array.isArray(certifications) && certifications.length > 0 ? (
          <img src={certifiticationPNG} height={20} width={20} />
        ) : null}
        {top_user_badge ? <img src={topUserPNG} height={20} width={20} /> : null}
      </div>

      <H2 as="h1" className={css.mobileHeading}>
        {displayName ? (
          <FormattedMessage id="ProfilePage.mobileHeading" values={{ name: displayName }} />
        ) : null}
        <div className={css.displayFlex}>
          {stripeAccount ? <img src={paymentVerifiedPNG} height={20} width={20} /> : null}
          {stripeAccount ? <img src={profileVerifiedPNG} height={20} width={20} /> : null}
          {certifications && Array.isArray(certifications) && certifications.length > 0 ? (
            <img src={certifiticationPNG} height={20} width={20} />
          ) : null}
          {top_user_badge ? <img src={topUserPNG} height={20} width={20} /> : null}
        </div>
      </H2>
      {showLinkToProfileSettingsPage ? (
        <>
          <NamedLink className={css.editLinkMobile} name="ProfileSettingsPage">
            <FormattedMessage id="ProfilePage.editProfileLinkMobile" />
          </NamedLink>
          <NamedLink className={css.editLinkDesktop} name="ProfileSettingsPage">
            <FormattedMessage id="ProfilePage.editProfileLinkDesktop" />
          </NamedLink>
        </>
      ) : null}
      <Share
        title={intl.formatMessage({
          id: 'ProfilePage.ogTitle'
        })}
        description={intl.formatMessage({
          id: 'ProfilePage.ogDescription'
        })}
      />
    </div>
  );
};

export const ReviewsErrorMaybe = props => {
  const { queryReviewsError } = props;
  return queryReviewsError ? (
    <p className={css.error}>
      <FormattedMessage id="ProfilePage.loadingReviewsFailed" />
    </p>
  ) : null;
};

export const MobileReviews = props => {
  const { reviews, queryReviewsError } = props;
  const reviewsOfProvider = reviews.filter(r => r.attributes.type === REVIEW_TYPE_OF_PROVIDER);
  const reviewsOfCustomer = reviews.filter(r => r.attributes.type === REVIEW_TYPE_OF_CUSTOMER);
  return (
    <div className={css.mobileReviews}>
      <H4 as="h2" className={css.mobileReviewsTitle}>
        <FormattedMessage
          id="ProfilePage.reviewsFromMyCustomersTitle"
          values={{ count: reviewsOfProvider.length }}
        />
      </H4>
      <ReviewsErrorMaybe queryReviewsError={queryReviewsError} />
      <Reviews reviews={reviewsOfProvider} />
      <H4 as="h2" className={css.mobileReviewsTitle}>
        <FormattedMessage
          id="ProfilePage.reviewsAsACustomerTitle"
          values={{ count: reviewsOfCustomer.length }}
        />
      </H4>
      <ReviewsErrorMaybe queryReviewsError={queryReviewsError} />
      <Reviews reviews={reviewsOfCustomer} />
    </div>
  );
};

export const DesktopReviews = props => {
  const [showReviewsType, setShowReviewsType] = useState(REVIEW_TYPE_OF_PROVIDER);
  const { reviews, queryReviewsError } = props;
  const reviewsOfProvider = reviews.filter(r => r.attributes.type === REVIEW_TYPE_OF_PROVIDER);
  const reviewsOfCustomer = reviews.filter(r => r.attributes.type === REVIEW_TYPE_OF_CUSTOMER);
  const isReviewTypeProviderSelected = showReviewsType === REVIEW_TYPE_OF_PROVIDER;
  const isReviewTypeCustomerSelected = showReviewsType === REVIEW_TYPE_OF_CUSTOMER;
  const desktopReviewTabs = [
    {
      text: (
        <Heading as="h4" rootClassName={css.desktopReviewsTitle}>
          <FormattedMessage
            id="ProfilePage.reviewsFromMyCustomersTitle"
            values={{ count: reviewsOfProvider.length }}
          />
        </Heading>
      ),
      selected: isReviewTypeProviderSelected,
      onClick: () => setShowReviewsType(REVIEW_TYPE_OF_PROVIDER),
    },
    {
      text: (
        <Heading as="h4" rootClassName={css.desktopReviewsTitle}>
          <FormattedMessage
            id="ProfilePage.reviewsAsACustomerTitle"
            values={{ count: reviewsOfCustomer.length }}
          />
        </Heading>
      ),
      selected: isReviewTypeCustomerSelected,
      onClick: () => setShowReviewsType(REVIEW_TYPE_OF_CUSTOMER),
    },
  ];

  return (
    <div className={css.desktopReviews}>
      <div className={css.desktopReviewsWrapper}>
        <ButtonTabNavHorizontal className={css.desktopReviewsTabNav} tabs={desktopReviewTabs} />

        <ReviewsErrorMaybe queryReviewsError={queryReviewsError} />

        {isReviewTypeProviderSelected ? (
          <Reviews reviews={reviewsOfProvider} />
        ) : (
          <Reviews reviews={reviewsOfCustomer} />
        )}
      </div>
    </div>
  );
};

export const CustomUserFields = props => {
  const { publicData, metadata, userFieldConfig } = props;
  const { certifications } = publicData;
  const shouldPickUserField = fieldConfig => fieldConfig?.showConfig?.displayInProfile !== false;
  const propsForCustomFields =
    pickCustomFieldProps(publicData, metadata, userFieldConfig, 'userType', shouldPickUserField) ||
    [];

  return (
    <>
      <SectionDetailsMaybe {...props} />
      {propsForCustomFields.map(customFieldProps => {
        const { schemaType, ...fieldProps } = customFieldProps;
        return schemaType === SCHEMA_TYPE_MULTI_ENUM ? (
          <SectionMultiEnumMaybe {...fieldProps} />
        ) : schemaType === SCHEMA_TYPE_TEXT ? (
          <SectionTextMaybe {...fieldProps} />
        ) : schemaType === SCHEMA_TYPE_YOUTUBE ? (
          <SectionYoutubeVideoMaybe {...fieldProps} />
        ) : null;
      })}
      {certifications ? (
        <div>
          <Heading as="h2" rootClassName={css.sectionHeading}>
            <FormattedMessage id="ProfilePage.certification" />
          </Heading>
          <div className={css.flexCertification}>
            {certifications.map(certification => {
              const fileType = checkFileType(certification).split(',')[1];
              const getFileName = checkFileType(certification).split(',')[0];
              const isFileDocument = FILE_DOCUMENT_TYPES.includes(fileType.toString());

              const renderDocument = (
                <div className={css.thumbFile}>
                  <span className={css.thumbFileText}>{getFileName}</span>
                </div>
              );

              const renderFile = isFileDocument ? (
                renderDocument
              ) : (
                <ImageFromS3
                  id={certification}
                  rootClassName={css.thumbImage}
                  aspectWidth={1}
                  aspectHeight={1}
                  file={certification}
                />
              );

              return (
                <li className={css.thumb} key={certification}>
                  <div className={css.actionButtons}>
                    <PreviewLink file={certification} />
                  </div>
                  <div className={css.thumbInner}>{renderFile}</div>
                </li>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
};

export const MainContent = props => {
  const {
    userShowError,
    bio,
    displayName,
    listings,
    queryListingsError,
    reviews,
    queryReviewsError,
    publicData,
    metadata,
    userFieldConfig,
    intl,
    hideReviews,
    onManageDisableScrolling,
    setReviewModalOpen,
    isReviewModalOpen,
    config,
    reviewSubmitted,
    setReviewSubmitted,
    sendReviewInProgress,
    sendReviewError,
    isCurrentUser,
    onSendReview,
    profileId,
    currentUserDisplayName,
  } = props;

  const hasListings = listings.length > 0;
  const hasMatchMedia = typeof window !== 'undefined' && window?.matchMedia;
  const isMobileLayout = hasMatchMedia
    ? window.matchMedia(`(max-width: ${MAX_MOBILE_SCREEN_WIDTH}px)`)?.matches
    : true;

  const hasBio = !!bio;
  const bioWithLinks = richText(bio, {
    linkify: true,
    longWordMinLength: MIN_LENGTH_FOR_LONG_WORDS,
    longWordClass: css.longWord,
  });

  const listingsContainerClasses = classNames(css.listingsContainer, {
    [css.withBioMissingAbove]: !hasBio,
  });

  if (userShowError || queryListingsError) {
    return (
      <p className={css.error}>
        <FormattedMessage id="ProfilePage.loadingDataFailed" />
      </p>
    );
  }

  const { publicReviews } = publicData || {};

  let openReview = publicReviews;

  // Submit review and close the review modal
  const onSubmitReview = values => {
    const { reviewRating, reviewContent } = values;
    const rating = Number.parseInt(reviewRating, 10);
    const review = {
      reviewRating: rating,
      reviewContent,
      createdAt: new Date().toISOString(),
      name: currentUserDisplayName,
    };
    if (openReview && Array.isArray(openReview) && openReview.length > 0) {
      openReview.push(review);
    } else {
      openReview = [review];
    }

    const params = {
      id: profileId,
      publicData: {
        publicReviews: openReview,
      },
    };

    onSendReview(params)
      .then(r => {
        setReviewModalOpen(false);
        setReviewSubmitted(true);
      })
      .catch(e => {
        // Do nothing.
      });
  };

  return (
    <div>
      <H2 as="h1" className={css.desktopHeading}>
        <FormattedMessage id="ProfilePage.desktopHeading" values={{ name: displayName }} />
      </H2>
      {/* {hasBio ? <p className={css.bio}>{bioWithLinks}</p> : null} */}

      {displayName ? (
        <CustomUserFields
          publicData={publicData}
          metadata={metadata}
          userFieldConfig={userFieldConfig}
          intl={intl}
        />
      ) : null}

      {hasListings ? (
        <div className={listingsContainerClasses}>
          <H4 as="h2" className={css.listingsTitle}>
            <FormattedMessage id="ProfilePage.listingsTitle" values={{ count: listings.length }} />
          </H4>
          <ul className={css.listings}>
            {listings.map(l => (
              <li className={css.listing} key={l.id.uuid}>
                <ListingCard listing={l} showAuthorInfo={false} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isCurrentUser ? (
        <div
          className={css.reviewBtton}
          onClick={() => {
            setReviewModalOpen(true);
          }}
        >
          <FormattedMessage id="ProfilePage.reviewButton" />
        </div>
      ) : null}

      {publicReviews ? (
        <div className={css.publicReviewComponent}>
          <H4 as="h2" className={css.publicReviewTitle}>
            <FormattedMessage id="ProfilePage.publicReview" />
          </H4>

          {publicReviews.map((review, index) => {
            const getDate = review.createdAt ? moment(review.createdAt).format('DD/MM/YYYY') : null;
            const displayName = review.name;
            return (
              <div className={css.publicReview} key={index}>
                <ReviewRating
                  rating={review.reviewRating}
                  className={css.mobileReviewRating}
                  reviewStarClassName={css.reviewRatingStar}
                />
                <div className={css.publicReviewContent}>{review.reviewContent}</div>

                <div className={css.publicReviewName}>
                  {displayName ? <div>{displayName}</div> : null}
                  {getDate ? <div>{getDate}</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {hideReviews ? null : isMobileLayout ? (
        <MobileReviews reviews={reviews} queryReviewsError={queryReviewsError} />
      ) : (
        <DesktopReviews reviews={reviews} queryReviewsError={queryReviewsError} />
      )}
      <CustomReviewModal
        id="ReviewOrderModal"
        isOpen={isReviewModalOpen}
        onCloseModal={() => setReviewModalOpen(false)}
        onManageDisableScrolling={onManageDisableScrolling}
        onSubmitReview={onSubmitReview}
        reviewSent={reviewSubmitted}
        sendReviewInProgress={sendReviewInProgress}
        sendReviewError={sendReviewError}
        marketplaceName={config.marketplaceName}
      />
    </div>
  );
};

export const ProfilePageComponent = props => {
  const config = useConfiguration();
  const intl = useIntl();
  const [mounted, setMounted] = useState(false);
  const [isReviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    scrollingDisabled,
    params: pathParams,
    currentUser,
    useCurrentUser,
    userShowError,
    user,
    onManageDisableScrolling,
    onSendReview,
    ...rest
  } = props;
  const isVariant = pathParams.variant?.length > 0;
  const isPreview = isVariant && pathParams.variant === PROFILE_PAGE_PENDING_APPROVAL_VARIANT;

  // Stripe's onboarding needs a business URL for each seller, but the profile page can be
  // too empty for the provider at the time they are creating their first listing.
  // To remedy the situation, we redirect Stripe's crawler to the landing page of the marketplace.
  // TODO: When there's more content on the profile page, we should consider by-passing this redirection.
  const searchParams = rest?.location?.search;
  const isStorefront = searchParams
    ? new URLSearchParams(searchParams)?.get('mode') === 'storefront'
    : false;
  if (isStorefront) {
    return <NamedRedirect name="LandingPage" />;
  }

  const isCurrentUser = currentUser?.id && currentUser?.id?.uuid === pathParams.id;
  const profileUser = useCurrentUser ? currentUser : user;
  const { bio, displayName, publicData, metadata } = profileUser?.attributes?.profile || {};
  const { userFields } = config.user;
  const isPrivateMarketplace = config.accessControl.marketplace.private === true;
  const isUnauthorizedUser = currentUser && !isUserAuthorized(currentUser);
  const isUnauthorizedOnPrivateMarketplace = isPrivateMarketplace && isUnauthorizedUser;
  const hasUserPendingApprovalError = isErrorUserPendingApproval(userShowError);
  const hasNoViewingRightsUser = currentUser && !hasPermissionToViewData(currentUser);
  const hasNoViewingRightsOnPrivateMarketplace = isPrivateMarketplace && hasNoViewingRightsUser;

  const isDataLoaded = isPreview
    ? currentUser != null || userShowError != null
    : hasNoViewingRightsOnPrivateMarketplace
      ? currentUser != null || userShowError != null
      : user != null || userShowError != null;

  const schemaTitleVars = { name: displayName, marketplaceName: config.marketplaceName };
  const schemaTitle = intl.formatMessage({ id: 'ProfilePage.schemaTitle' }, schemaTitleVars);
  const { displayName: currentUserDisplayName } = currentUser?.attributes?.profile || {};

  if (!isDataLoaded) {
    return null;
  } else if (!isPreview && isNotFoundError(userShowError)) {
    return <NotFoundPage staticContext={props.staticContext} />;
  } else if (!isPreview && (isUnauthorizedOnPrivateMarketplace || hasUserPendingApprovalError)) {
    return (
      <NamedRedirect
        name="NoAccessPage"
        params={{ missingAccessRight: NO_ACCESS_PAGE_USER_PENDING_APPROVAL }}
      />
    );
  } else if (
    (!isPreview && hasNoViewingRightsOnPrivateMarketplace && !isCurrentUser) ||
    isErrorNoViewingPermission(userShowError)
  ) {
    // Someone without viewing rights on a private marketplace is trying to
    // view a profile page that is not their own – redirect to NoAccessPage
    return (
      <NamedRedirect
        name="NoAccessPage"
        params={{ missingAccessRight: NO_ACCESS_PAGE_VIEW_LISTINGS }}
      />
    );
  } else if (!isPreview && isForbiddenError(userShowError)) {
    // This can happen if private marketplace mode is active, but it's not reflected through asset yet.
    return (
      <NamedRedirect
        name="SignupPage"
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  } else if (isPreview && mounted && !isCurrentUser) {
    // Someone is manipulating the URL, redirect to current user's profile page.
    return isCurrentUser === false ? (
      <NamedRedirect name="ProfilePage" params={{ id: currentUser?.id?.uuid }} />
    ) : null;
  } else if ((isPreview || isPrivateMarketplace) && !mounted) {
    // This preview of the profile page is not rendered on server-side
    // and the first pass on client-side should render the same UI.
    return null;
  }
  // This is rendering normal profile page (not preview for pending-approval)
  return (
    <Page
      scrollingDisabled={scrollingDisabled}
      title={schemaTitle}
      // schema={{
      //   '@context': 'http://schema.org',
      //   '@type': 'ProfilePage',
      //   name: schemaTitle,
      // }}
      socialSharing={{
        title: intl.formatMessage({
          id: 'ProfilePage.ogTitle',
        }),
        description: intl.formatMessage({
          id: 'ProfilePage.ogDescription',
        }),
        images1200: [{
          width: 1280,
          height: 720,
          url: 'https://cdn.prod.website-files.com/67388105e786c44d2fd25e83/6752e663a4801698954d151d_italiawork-social-sharing.jpg',
        }],
      }}
      schema={{
        '@context': 'http://schema.org',
        '@type': 'ProfilePage',
        name: schemaTitle,
      }}
    >
      <LayoutSideNavigation
        sideNavClassName={css.aside}
        topbar={<TopbarContainer />}
        sideNav={
          <AsideContent
            user={profileUser}
            showLinkToProfileSettingsPage={mounted && isCurrentUser}
            displayName={displayName}
            publicData={publicData}
          />
        }
        footer={<FooterContainer />}
      >
        <MainContent
          bio={bio}
          displayName={displayName}
          userShowError={userShowError}
          publicData={publicData}
          metadata={metadata}
          userFieldConfig={userFields}
          hideReviews={hasNoViewingRightsOnPrivateMarketplace}
          intl={intl}
          onManageDisableScrolling={onManageDisableScrolling}
          isReviewModalOpen={isReviewModalOpen}
          setReviewModalOpen={setReviewModalOpen}
          config={config}
          reviewSubmitted={reviewSubmitted}
          setReviewSubmitted={setReviewSubmitted}
          isCurrentUser={isCurrentUser}
          onSendReview={onSendReview}
          profileId={profileUser?.id}
          currentUserDisplayName={currentUserDisplayName}
          {...rest}
        />
      </LayoutSideNavigation>
    </Page>
  );
};

ProfilePageComponent.defaultProps = {
  currentUser: null,
  user: null,
  userShowError: null,
  queryListingsError: null,
  reviews: [],
  queryReviewsError: null,
};

ProfilePageComponent.propTypes = {
  scrollingDisabled: bool.isRequired,
  currentUser: propTypes.currentUser,
  useCurrentUser: bool.isRequired,
  user: oneOfType([propTypes.user, propTypes.currentUser]),
  userShowError: propTypes.error,
  queryListingsError: propTypes.error,
  listings: arrayOf(oneOfType([propTypes.listing, propTypes.ownListing])).isRequired,
  reviews: arrayOf(propTypes.review),
  queryReviewsError: propTypes.error,
};

const mapStateToProps = state => {
  const { currentUser } = state.user;
  const {
    userId,
    userShowError,
    queryListingsError,
    userListingRefs,
    reviews,
    queryReviewsError,
    sendReviewInProgress,
    sendReviewError,
  } = state.ProfilePage;

  const userMatches = getMarketplaceEntities(state, [{ type: 'user', id: userId }]);
  const user = userMatches.length === 1 ? userMatches[0] : null;

  // Show currentUser's data if it's not approved yet
  const isCurrentUser = userId?.uuid === currentUser?.id?.uuid;
  const useCurrentUser =
    isCurrentUser && !(isUserAuthorized(currentUser) && hasPermissionToViewData(currentUser));

  const listingsData = getMarketplaceEntities(state, userListingRefs);
  const listings = _.filter(
    listingsData,
    listing =>
      listing.attributes.publicData.transactionProcessAlias !== 'default-purchase/release-1'
  );

  return {
    scrollingDisabled: isScrollingDisabled(state),
    currentUser,
    useCurrentUser,
    user,
    userShowError,
    queryListingsError,
    listings,
    reviews,
    queryReviewsError,
    sendReviewInProgress,
    sendReviewError,
  };
};

const mapDispatchToProps = dispatch => {
  return {
    onManageDisableScrolling: (componentId, disableScrolling) =>
      dispatch(manageDisableScrolling(componentId, disableScrolling)),
    onSendReview: params => dispatch(addUserReview(params)),
  };
};

const ProfilePage = compose(connect(mapStateToProps, mapDispatchToProps))(ProfilePageComponent);

export default ProfilePage;
