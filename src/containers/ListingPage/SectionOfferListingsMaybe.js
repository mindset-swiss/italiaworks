import classNames from 'classnames';
import React, { useState } from 'react';
import { Form as FinalForm } from 'react-final-form';
import { FormattedMessage } from 'react-intl';
import { useHistory } from 'react-router-dom/cjs/react-router-dom.min';
import certifiticationPNG from '../../assets/certificates.png';
import paymentVerifiedPNG from '../../assets/payment-verified.png';
import profileVerifiedPNG from '../../assets/profile-verified.png';
import topUserPNG from '../../assets/top-user.png';
import { AvatarSmall, Form, H4, ReviewRatingCustom } from '../../components';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { formatMoney } from '../../util/currency';
import { ensureUser } from '../../util/data';
import { richText } from '../../util/richText';
import { types as sdkTypes } from '../../util/sdkLoader';
import { MIN_LENGTH_FOR_LONG_WORDS } from '../ProfilePage/ProfilePage';
import css from './ListingPage.module.css';
import { handleCustomSubmit } from './ListingPage.shared';
const { Money } = sdkTypes;

const maxLength = 200;

const SectionOfferListingsMaybe = props => {
  const {
    listings,
    intl,
    onInitializeCardPaymentData,
    currentUser,
    callSetInitialValues,
    getListing,
    rootClassName,
    className,
    isOwnListing,
    setUpdateOfferModalOpen,
    setSelectedListing,
    offerReviews,
    calculateAvgRating,
  } = props;
  const routes = useRouteConfiguration();
  const history = useHistory();
  return (
    <div className={css.sectionOfferListingContent}>
      <H4>
        <FormattedMessage
          id="ListingPage.SectionOfferListingsMaybe.title"
          values={{
            value: (
              <span style={{ fontWeight: 'bold' }}>{listings?.length ? listings.length : 0}</span>
            ),
          }}
        />
      </H4>
      {listings
        ? listings.map(listing => {
            const [isExpanded, setIsExpanded] = useState(false);
            const {
              attributes,
              author,
              id,
              reviews,
              stripeConnected,
              stripeAccount,
              top_user_badge,
              certifications,
            } = listing || {};
            const { description, price, title } = attributes || {};
            const rating =
              reviews.map(review => review.attributes.rating).reduce((a, b) => a + b, 0) /
              reviews.length;
            const ensuredAuthor = ensureUser(author);
            const { displayName } = ensuredAuthor?.attributes?.profile || {};
            const convertPrice = new Money(price.amount, price.currency);
            const formattedPrice = formatMoney(intl, convertPrice);

            const listingIsPublishedByUser = currentUser
              ? author.id.uuid === currentUser.id.uuid
              : true;
            const descriptionLength = description.length;

            const displayText = isExpanded ? description : `${description.slice(0, maxLength)}...`;
            const descriptionWithLinks = richText(displayText, {
              linkify: true,
              longWordMinLength: MIN_LENGTH_FOR_LONG_WORDS,
              longWordClass: css.longWord,
            });

            if (!isOwnListing) {
              if (!listingIsPublishedByUser) return null;
            }

            return (
              <FinalForm
                rootClassName={rootClassName}
                className={className}
                key={id.uuid}
                onSubmit={() => {
                  const onSubmit = handleCustomSubmit({
                    currentUser,
                    callSetInitialValues,
                    getListing,
                    onInitializeCardPaymentData,
                    routes,
                    history,
                    params: {
                      slug: title,
                      id: id.uuid,
                    },
                    listing,
                  });
                  const values = { quantity: '1', deliveryMethod: 'none' };

                  onSubmit(values);
                }}
                render={fieldRenderProps => {
                  const {
                    rootClassName,
                    className,
                    submitButtonWrapperClassName,
                    formId,
                    handleSubmit,
                    inProgress,
                    intl,
                    authorDisplayName,
                    sendInquiryError,
                    marketplaceCurrency,
                    form,
                    values,
                  } = fieldRenderProps;
                  const classes = classNames(rootClassName || css.root, className);

                  const linkProps = {
                    name: 'ProfilePage',
                    params: {
                      id: author.id.uuid,
                    },
                  };

                  return (
                    <Form
                      className={classes}
                      onSubmit={handleSubmit}
                      enforcePagePreloadFor="OrderDetailsPage"
                    >
                      <div key={listing.id.uuid} className={css.offerListingContent}>
                        {/* <div className={css.offerListingAvatarContent}>
                        <NamedLink {...linkProps} className={css.showFlex}>
                          <AvatarSmall
                            user={ensuredAuthor}
                            className={css.providerAvatar}
                            disableProfileLink={true}
                          />
                          <div>
                            <div className={css.displayName}>{displayName}</div>
                            {!!offerReviews?.[ensuredAuthor?.id?.uuid]?.length && (
                              <ReviewRatingCustom
                                rating={calculateAvgRating(offerReviews[ensuredAuthor.id.uuid])}
                                reviews={offerReviews?.[ensuredAuthor.id.uuid].length}
                              />
                            )}

                            <div className={css.offerListingAvatarContent}>
                              <div className={css.offerListingPrice}>{formattedPrice}</div>
                              {listingIsPublishedByUser ? (
                                <div
                                  className={css.offerListingAcceptOfferButton}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setSelectedListing(listing);
                                    setUpdateOfferModalOpen(true);
                                  }}
                                >
                                  <FormattedMessage id="ListingPage.editOfferButton" />
                                </div>
                              ) : (
                                <div
                                  className={
                                    listingIsPublishedByUser
                                      ? css.disableOfferListingAcceptOfferButton
                                      : css.offerListingAcceptOfferButton
                                  }
                                  onClick={listingIsPublishedByUser ? () => { } : handleSubmit}
                                >
                                  <FormattedMessage id="ListingPage.acceptOfferButton" />
                                </div>
                              )}
                            </div>
                            <div className={classNames(css.showFlex, css.padding)}>
                              <AvatarSmall user={ensuredAuthor} />
                              <div>
                                {displayName}
                                {rating ? (
                                  <ReviewRating
                                    reviewStarClassName={css.reviewStar}
                                    className={css.reviewStars}
                                    rating={rating}
                                  />
                                ) : null}
                              </div>
                              {stripeConnected ? (
                                <img src={paymentVerifiedPNG} height={16} width={16} />
                              ) : null}
                              {stripeAccount ? (
                                <img src={profileVerifiedPNG} height={16} width={16} />
                              ) : null}
                              {top_user_badge ? <img src={topUserPNG} height={16} width={16} /> : null}
                              {certifications ? (
                                <img src={certifiticationPNG} height={16} width={16} />
                              ) : null}
                            </div>
                          </div>
                          <div className={css.offerListingDescriptionContent}>
                            <p className={`${css.offerListingBio} ${isExpanded ? css.expanded : ''}`}>{descriptionWithLinks}</p>
                            {descriptionLength >= maxLength && (
                              <div className={css.expandButton} onClick={() => setIsExpanded(!isExpanded)}>
                                <FormattedMessage id={isExpanded ? 'ListingPage.SectionOfferListingsMaybe.collapse' : 'ListingPage.SectionOfferListingsMaybe.expand'} />
                              </div>
                            )}
                          </div>
                        </NamedLink>
                      </div> */}
                        <div className={css.offerListingAvatarContent}>
                          <div className={css.offerListingPrice}>{formattedPrice}</div>
                          {listingIsPublishedByUser ? (
                            <div
                              className={css.offerListingAcceptOfferButton}
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedListing(listing);
                                setUpdateOfferModalOpen(true);
                              }}
                            >
                              <FormattedMessage id="ListingPage.editOfferButton" />
                            </div>
                          ) : (
                            <div
                              className={
                                listingIsPublishedByUser
                                  ? css.disableOfferListingAcceptOfferButton
                                  : css.offerListingAcceptOfferButton
                              }
                              onClick={listingIsPublishedByUser ? () => {} : handleSubmit}
                            >
                              <FormattedMessage id="ListingPage.acceptOfferButton" />
                            </div>
                          )}
                        </div>
                        <div className={classNames(css.showFlex, css.padding)}>
                          <AvatarSmall user={ensuredAuthor} />
                          <div>
                            {displayName}
                            {!!offerReviews?.[ensuredAuthor?.id?.uuid]?.length && (
                              <ReviewRatingCustom
                                rating={calculateAvgRating(offerReviews[ensuredAuthor.id.uuid])}
                                reviews={offerReviews?.[ensuredAuthor.id.uuid].length}
                              />
                            )}
                          </div>
                          {stripeConnected ? (
                            <img src={paymentVerifiedPNG} height={16} width={16} />
                          ) : null}
                          {stripeAccount ? (
                            <img src={profileVerifiedPNG} height={16} width={16} />
                          ) : null}
                          {top_user_badge ? <img src={topUserPNG} height={16} width={16} /> : null}
                          {certifications ? (
                            <img src={certifiticationPNG} height={16} width={16} />
                          ) : null}
                        </div>
                        <div className={css.offerListingDescriptionContent}>
                          <p className={`${css.offerListingBio} ${isExpanded ? css.expanded : ''}`}>
                            {descriptionWithLinks}
                          </p>
                          {descriptionLength >= maxLength && (
                            <div
                              className={css.expandButton}
                              onClick={() => setIsExpanded(!isExpanded)}
                            >
                              <FormattedMessage
                                id={
                                  isExpanded
                                    ? 'ListingPage.SectionOfferListingsMaybe.collapse'
                                    : 'ListingPage.SectionOfferListingsMaybe.expand'
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </Form>
                  );
                }}
              />
            );
          })
        : null}
    </div>
  );
};

export default SectionOfferListingsMaybe;
