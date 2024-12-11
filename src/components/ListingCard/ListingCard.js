import React from 'react';
import { string, func, bool, oneOfType } from 'prop-types';
import classNames from 'classnames';
import moment from 'moment';

import { useConfiguration } from '../../context/configurationContext';

import { FormattedMessage, intlShape, injectIntl } from '../../util/reactIntl';
import { displayPrice } from '../../util/configHelpers';
import { lazyLoadWithDimensions } from '../../util/uiHelpers';
import { propTypes } from '../../util/types';
import { formatMoney } from '../../util/currency';
import { ensureListing, ensureUser } from '../../util/data';
import { richText } from '../../util/richText';
import { createSlug } from '../../util/urlHelpers';
import { isBookingProcessAlias } from '../../transactions/transaction';

import { AspectRatioWrapper, AvatarMedium, NamedLink, ResponsiveImage } from '../../components';
import ListingCardAddress from './ListingCardAddress';
import ListingCardDate from './ListingCardDate';
import ListingCardOffers from './ListingCardOffers';

import css from './ListingCard.module.css';

const MIN_LENGTH_FOR_LONG_WORDS = 10;

const priceData = (price, currency, intl) => {
  if (price && price.currency === currency) {
    const formattedPrice = formatMoney(intl, price);
    return { formattedPrice, priceTitle: formattedPrice };
  } else if (price) {
    return {
      formattedPrice: intl.formatMessage(
        { id: 'ListingCard.unsupportedPrice' },
        { currency: price.currency }
      ),
      priceTitle: intl.formatMessage(
        { id: 'ListingCard.unsupportedPriceTitle' },
        { currency: price.currency }
      ),
    };
  }
  return {};
};

const LazyImage = lazyLoadWithDimensions(ResponsiveImage, { loadAfterInitialRendering: 3000 });

const PriceMaybe = props => {
  const { price, publicData, config, intl } = props;
  const { listingType } = publicData || {};
  const validListingTypes = config.listing.listingTypes;
  const foundListingTypeConfig = validListingTypes.find(conf => conf.listingType === listingType);
  const showPrice = displayPrice(foundListingTypeConfig);
  if (!showPrice && price) {
    return null;
  }

  const isBookable = isBookingProcessAlias(publicData?.transactionProcessAlias);
  const { formattedPrice, priceTitle } = priceData(price, config.currency, intl);
  return (
    <div className={css.price}>
      <div className={css.priceValue} title={priceTitle}>
        {formattedPrice}
      </div>
      {isBookable ? (
        <div className={css.perUnit}>
          <FormattedMessage id="ListingCard.perUnit" values={{ unitType: publicData?.unitType }} />
        </div>
      ) : null}
    </div>
  );
};

export const ListingCardComponent = props => {
  const config = useConfiguration();
  const {
    className,
    rootClassName,
    intl,
    listing,
    renderSizes,
    setActiveListing,
    showAuthorInfo,
  } = props;
  const classes = classNames(rootClassName || css.root, className);
  const currentListing = ensureListing(listing);
  const id = currentListing.id.uuid;
  const { title = '', price, publicData } = currentListing.attributes;
  const slug = createSlug(title);
  const author = ensureUser(listing.author);
  const authorName = author.attributes.profile.displayName;
  const firstImage =
    currentListing.images && currentListing.images.length > 0 ? currentListing.images[0] : null;

  const capitalizeFirstLetter = val => {
    return `${String(val).charAt(0).toUpperCase()}${String(val).slice(1)}`;
  }

  const {
    aspectWidth = 1,
    aspectHeight = 1,
    variantPrefix = 'listing-card',
  } = config.layout.listingImage;
  const variants = firstImage
    ? Object.keys(firstImage?.attributes?.variants).filter(k => k.startsWith(variantPrefix))
    : [];

  const setActivePropsMaybe = setActiveListing
    ? {
      onMouseEnter: () => setActiveListing(currentListing.id),
      onMouseLeave: () => setActiveListing(null),
    }
    : null;

  let address = '';

  if (currentListing?.attributes?.publicData?.location?.address) {
    address = currentListing.attributes.publicData.location.address;
  } else if (currentListing?.attributes?.publicData?.project_type && currentListing.attributes.publicData.project_type === 'online') {
    address = <FormattedMessage id="ListingPage.online" />;
  }

  let selectedDate = '';

  if (currentListing?.attributes?.publicData?.selectedDate || currentListing?.attributes?.publicData?.selectedOption) {
    if (currentListing?.attributes?.publicData?.selectedOption === 'Sono flessibile') {
      selectedDate = currentListing.attributes.publicData.selectedOption;
    } else {
      selectedDate = `${currentListing?.attributes?.publicData?.selectedOption ? `${currentListing.attributes.publicData.selectedOption}: ` : ''}${currentListing?.attributes?.publicData?.selectedDate ? capitalizeFirstLetter(moment(currentListing.attributes.publicData.selectedDate).format('dddd D MMMM, YYYY')) : ''}`;
    }
  }
  
  const ensuredAuthor = ensureUser(currentListing.author);

  console.log(currentListing);

  return (
    <NamedLink className={classes} name="ListingPage" params={{ id, slug }}>
      {/* <AspectRatioWrapper
        className={css.aspectRatioWrapper}
        width={aspectWidth}
        height={aspectHeight}
        {...setActivePropsMaybe}
      >
        <LazyImage
          rootClassName={css.rootForImage}
          alt={title}
          image={firstImage}
          variants={variants}
          sizes={renderSizes}
        />
      </AspectRatioWrapper> */}
      <div className={css.card}>
        <div className={css.mainInfo}>
          <div className={css.title}>
            {richText(title, {
              longWordMinLength: MIN_LENGTH_FOR_LONG_WORDS,
              longWordClass: css.longWord,
            })}
          </div>
          <div className={css.meta}>
            {!!address && <ListingCardAddress text={address} />}
            {!!selectedDate && <ListingCardDate text={selectedDate} />}
            {/* TODO: get offers count */}
            {/* <ListingCardOffers /> */}
          </div>
          {/* TODO: listing status In cerca/Assegnato */}
          {/* <div className={css.status}>In cerca</div> */}
        </div>
        <div className={css.aside}>
          <PriceMaybe price={price} publicData={publicData} config={config} intl={intl} />
          <AvatarMedium user={ensuredAuthor} disableProfileLink={true} className={css.avatar} />
        </div>
      </div>
    </NamedLink>
  );
};

ListingCardComponent.defaultProps = {
  className: null,
  rootClassName: null,
  renderSizes: null,
  setActiveListing: null,
  showAuthorInfo: true,
};

ListingCardComponent.propTypes = {
  className: string,
  rootClassName: string,
  intl: intlShape.isRequired,
  listing: oneOfType([propTypes.listing, propTypes.ownListing]).isRequired,
  showAuthorInfo: bool,

  // Responsive image sizes hint
  renderSizes: string,

  setActiveListing: func,
};

export default injectIntl(ListingCardComponent);
