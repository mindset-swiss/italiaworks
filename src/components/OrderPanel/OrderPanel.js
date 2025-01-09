import loadable from '@loadable/component';
import classNames from 'classnames';
import omit from 'lodash/omit';
import {
  array,
  arrayOf,
  bool,
  func,
  node,
  number,
  object,
  oneOfType,
  shape,
  string,
} from 'prop-types';
import React from 'react';
import { withRouter } from 'react-router-dom';
import { compose } from 'redux';

import {
  INQUIRY_PROCESS_NAME,
  getSupportedProcessesInfo,
  isBookingProcess,
  isPurchaseProcess,
  resolveLatestProcessName,
} from '../../transactions/transaction';
import {
  displayDeliveryPickup,
  displayDeliveryShipping,
  displayPrice,
} from '../../util/configHelpers';
import { formatMoney } from '../../util/currency';
import { userDisplayNameAsString } from '../../util/data';
import { FormattedMessage, injectIntl, intlShape } from '../../util/reactIntl';
import {
  propTypes,
  AVAILABILITY_MULTIPLE_SEATS,
  LISTING_STATE_CLOSED,
  LINE_ITEM_NIGHT,
  LINE_ITEM_DAY,
  LINE_ITEM_HOUR,
  LINE_ITEM_ITEM,
  STOCK_INFINITE_MULTIPLE_ITEMS,
  STOCK_MULTIPLE_ITEMS,
} from '../../util/types';
import { parse, stringify } from '../../util/urlHelpers';

import { IconCheckmark, IconClose, ModalInMobile, PrimaryButton } from '../../components';

import css from './OrderPanel.module.css';
import { createResourceLocatorString } from '../../util/routes';

const BookingTimeForm = loadable(() =>
  import(/* webpackChunkName: "BookingTimeForm" */ './BookingTimeForm/BookingTimeForm')
);
const BookingDatesForm = loadable(() =>
  import(/* webpackChunkName: "BookingDatesForm" */ './BookingDatesForm/BookingDatesForm')
);
export const InquiryWithoutPaymentForm = loadable(() =>
  import(
    /* webpackChunkName: "InquiryWithoutPaymentForm" */ './InquiryWithoutPaymentForm/InquiryWithoutPaymentForm'
  )
);
const ProductOrderForm = loadable(() =>
  import(/* webpackChunkName: "ProductOrderForm" */ './ProductOrderForm/ProductOrderForm')
);

// This defines when ModalInMobile shows content as Modal
const MODAL_BREAKPOINT = 1023;
const TODAY = new Date();

export const priceData = (price, currency, intl) => {
  if (price && price.currency === currency) {
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

const formatMoneyIfSupportedCurrency = (price, intl) => {
  try {
    return formatMoney(intl, price);
  } catch (e) {
    return `(${price.currency})`;
  }
};

const openOrderModal = (isOwnListing, isClosed, history, location) => {
  if (isOwnListing || isClosed) {
    window.scrollTo(0, 0);
  } else {
    const { pathname, search, state } = location;
    const searchString = `?${stringify({ ...parse(search), orderOpen: true })}`;
    history.push(`${pathname}${searchString}`, state);
  }
};

const closeOrderModal = (history, location) => {
  const { pathname, search, state } = location;
  const searchParams = omit(parse(search), 'orderOpen');
  const searchString = `?${stringify(searchParams)}`;
  history.push(`${pathname}${searchString}`, state);
};

const handleSubmit = (
  isOwnListing,
  isClosed,
  isInquiryWithoutPayment,
  onSubmit,
  history,
  location
) => {
  // TODO: currently, inquiry-process does not have any form to ask more order data.
  // We can submit without opening any inquiry/order modal.
  return isInquiryWithoutPayment
    ? () => onSubmit({})
    : () => openOrderModal(isOwnListing, isClosed, history, location);
};

const dateFormattingOptions = { month: 'short', day: 'numeric', weekday: 'short' };

const PriceMaybe = props => {
  const {
    price,
    publicData,
    validListingTypes,
    intl,
    marketplaceCurrency,
    showCurrencyMismatch = false,
  } = props;
  const { listingType, unitType } = publicData || {};

  const foundListingTypeConfig = validListingTypes.find(conf => conf.listingType === listingType);
  const showPrice = displayPrice(foundListingTypeConfig);
  if (!showPrice || !price) {
    return null;
  }

  // Get formatted price or currency code if the currency does not match with marketplace currency
  const { formattedPrice, priceTitle } = priceData(price, marketplaceCurrency, intl);
  // TODO: In CTA, we don't have space to show proper error message for a mismatch of marketplace currency
  //       Instead, we show the currency code in place of the price
  return showCurrencyMismatch ? (
    <div className={css.priceContainerInCTA}>
      <div className={css.priceValue} title={priceTitle}>
        {formattedPrice}
      </div>
      <div className={css.perUnitInCTA}>
        <FormattedMessage id="OrderPanel.perUnit" values={{ unitType }} />
      </div>
    </div>
  ) : (
    <div className={css.priceContainer}>
      <p className={css.price}>{formatMoneyIfSupportedCurrency(price, intl)}</p>
      <div className={css.perUnit}>
        <FormattedMessage id="OrderPanel.perUnit" values={{ unitType }} />
      </div>
    </div>
  );
};

const OrderPanel = props => {
  const {
    rootClassName,
    className,
    titleClassName,
    listing,
    validListingTypes,
    lineItemUnitType: lineItemUnitTypeMaybe,
    isOwnListing,
    onSubmit,
    title,
    titleDesktop,
    author,
    authorLink,
    onManageDisableScrolling,
    onFetchTimeSlots,
    monthlyTimeSlots,
    history,
    location,
    intl,
    onFetchTransactionLineItems,
    onContactUser,
    lineItems,
    marketplaceCurrency,
    dayCountAvailableForBooking,
    marketplaceName,
    fetchLineItemsInProgress,
    fetchLineItemsError,
    payoutDetailsWarning,
    setInquiryModalOpen,
    currentUser,
    routes,
  } = props;

  const publicData = listing?.attributes?.publicData || {};
  const { listingType, unitType, transactionProcessAlias = '', flex_price } = publicData || {};

  const processName = resolveLatestProcessName(transactionProcessAlias.split('/')[0]);
  const lineItemUnitType = lineItemUnitTypeMaybe || `line-item/${unitType}`;

  const price = listing?.attributes?.price;
  const isPaymentProcess = processName !== INQUIRY_PROCESS_NAME;

  const showPriceMissing = isPaymentProcess && !price;
  const PriceMissing = () => {
    return (
      <p className={css.error}>
        <FormattedMessage id="OrderPanel.listingPriceMissing" />
      </p>
    );
  };
  const showInvalidCurrency = isPaymentProcess && price?.currency !== marketplaceCurrency;
  const InvalidCurrency = () => {
    return (
      <p className={css.error}>
        <FormattedMessage id="OrderPanel.listingCurrencyInvalid" />
      </p>
    );
  };

  const timeZone = listing?.attributes?.availabilityPlan?.timezone;
  const isClosed = listing?.attributes?.state === LISTING_STATE_CLOSED;

  const isBooking = isBookingProcess(processName);
  const shouldHaveBookingTime = isBooking && [LINE_ITEM_HOUR].includes(lineItemUnitType);
  const showBookingTimeForm = shouldHaveBookingTime && !isClosed && timeZone;

  const shouldHaveBookingDates =
    isBooking && [LINE_ITEM_DAY, LINE_ITEM_NIGHT].includes(lineItemUnitType);
  const showBookingDatesForm = shouldHaveBookingDates && !isClosed && timeZone;

  // The listing resource has a relationship: `currentStock`,
  // which you should include when making API calls.
  const isPurchase = isPurchaseProcess(processName);
  const currentStock = listing.currentStock?.attributes?.quantity;
  const isOutOfStock = isPurchase && lineItemUnitType === LINE_ITEM_ITEM && currentStock === 0;

  // Show form only when stock is fully loaded. This avoids "Out of stock" UI by
  // default before all data has been downloaded.
  const showProductOrderForm = isPurchase && typeof currentStock === 'number';

  const showInquiryForm = processName === INQUIRY_PROCESS_NAME;

  const supportedProcessesInfo = getSupportedProcessesInfo();
  const isKnownProcess = supportedProcessesInfo.map(info => info.name).includes(processName);

  const { pickupEnabled, shippingEnabled } = listing?.attributes?.publicData || {};

  const listingTypeConfig = validListingTypes.find(conf => conf.listingType === listingType);
  const displayShipping = displayDeliveryShipping(listingTypeConfig);
  const displayPickup = displayDeliveryPickup(listingTypeConfig);
  const allowOrdersOfMultipleItems = [STOCK_MULTIPLE_ITEMS, STOCK_INFINITE_MULTIPLE_ITEMS].includes(
    listingTypeConfig?.stockType
  );
  const seatsEnabled = [AVAILABILITY_MULTIPLE_SEATS].includes(listingTypeConfig?.availabilityType);

  const showClosedListingHelpText = listing.id && isClosed;
  const isOrderOpen = !!parse(location.search).orderOpen;

  const subTitleText = showClosedListingHelpText
    ? intl.formatMessage({ id: 'OrderPanel.subTitleClosedListing' })
    : null;

  const authorDisplayName = userDisplayNameAsString(author, '');

  const classes = classNames(rootClassName || css.root, className);
  const titleClasses = classNames(titleClassName || css.orderTitle);
  const formattedPrice = formatMoney(intl, price);

  return (
    <div className={classes}>
      {/* <ModalInMobile
        containerClassName={css.modalContainer}
        id="OrderFormInModal"
        isModalOpenOnMobile={isOrderOpen}
        onClose={() => closeOrderModal(history, location)}
        showAsModalMaxWidth={MODAL_BREAKPOINT}
        onManageDisableScrolling={onManageDisableScrolling}
        usePortal
      > */}
        {/* <div className={css.modalHeading}>
          <H1 className={css.heading}>{title}</H1>
        </div>

        <div className={css.orderHeading}>
          {titleDesktop ? titleDesktop : <H2 className={titleClasses}>{title}</H2>}
          {subTitleText ? <div className={css.orderHelp}>{subTitleText}</div> : null}
        </div> */}

        {/* <PriceMaybe
          price={price}
          publicData={publicData}
          validListingTypes={validListingTypes}
          intl={intl}
          marketplaceCurrency={marketplaceCurrency}
        /> */}

        {/* <div className={css.author}>
          <AvatarSmall user={author} className={css.providerAvatar} />
          <span className={css.providerNameLinked}>
            <FormattedMessage id="OrderPanel.author" values={{ name: authorLink }} />
          </span>
          <span className={css.providerNamePlain}>
            <FormattedMessage id="OrderPanel.author" values={{ name: authorDisplayName }} />
          </span>
        </div> */}

        {showPriceMissing ? (
          <PriceMissing />
        ) : showInvalidCurrency ? (
          <InvalidCurrency />
        ) : showBookingTimeForm ? (
          <BookingTimeForm
            seatsEnabled={seatsEnabled}
            className={css.bookingForm}
            formId="OrderPanelBookingTimeForm"
            lineItemUnitType={lineItemUnitType}
            onSubmit={onSubmit}
            price={price}
            marketplaceCurrency={marketplaceCurrency}
            dayCountAvailableForBooking={dayCountAvailableForBooking}
            listingId={listing.id}
            isOwnListing={isOwnListing}
            monthlyTimeSlots={monthlyTimeSlots}
            onFetchTimeSlots={onFetchTimeSlots}
            startDatePlaceholder={intl.formatDate(TODAY, dateFormattingOptions)}
            endDatePlaceholder={intl.formatDate(TODAY, dateFormattingOptions)}
            timeZone={timeZone}
            marketplaceName={marketplaceName}
            onFetchTransactionLineItems={onFetchTransactionLineItems}
            lineItems={lineItems}
            fetchLineItemsInProgress={fetchLineItemsInProgress}
            fetchLineItemsError={fetchLineItemsError}
            payoutDetailsWarning={payoutDetailsWarning}
          />
        ) : showBookingDatesForm ? (
          <BookingDatesForm
            seatsEnabled={seatsEnabled}
            className={css.bookingForm}
            formId="OrderPanelBookingDatesForm"
            lineItemUnitType={lineItemUnitType}
            onSubmit={onSubmit}
            price={price}
            marketplaceCurrency={marketplaceCurrency}
            dayCountAvailableForBooking={dayCountAvailableForBooking}
            listingId={listing.id}
            isOwnListing={isOwnListing}
            monthlyTimeSlots={monthlyTimeSlots}
            onFetchTimeSlots={onFetchTimeSlots}
            timeZone={timeZone}
            marketplaceName={marketplaceName}
            onFetchTransactionLineItems={onFetchTransactionLineItems}
            lineItems={lineItems}
            fetchLineItemsInProgress={fetchLineItemsInProgress}
            fetchLineItemsError={fetchLineItemsError}
            payoutDetailsWarning={payoutDetailsWarning}
          />
        ) : showProductOrderForm ? (
          <ProductOrderForm
            formId="OrderPanelProductOrderForm"
            onSubmit={onSubmit}
            price={price}
            marketplaceCurrency={marketplaceCurrency}
            currentStock={currentStock}
            allowOrdersOfMultipleItems={allowOrdersOfMultipleItems}
            pickupEnabled={pickupEnabled && displayPickup}
            shippingEnabled={shippingEnabled && displayShipping}
            displayDeliveryMethod={displayPickup || displayShipping}
            listingId={listing.id}
            isOwnListing={isOwnListing}
            marketplaceName={marketplaceName}
            onFetchTransactionLineItems={onFetchTransactionLineItems}
            onContactUser={onContactUser}
            lineItems={lineItems}
            fetchLineItemsInProgress={fetchLineItemsInProgress}
            fetchLineItemsError={fetchLineItemsError}
            payoutDetailsWarning={payoutDetailsWarning}
          />
        ) : showInquiryForm ? (
          // <InquiryWithoutPaymentForm formId="OrderPanelInquiryForm" onSubmit={onSubmit} />
          <div className={css.customInquiryForm}>
            <div>
              <div className={css.customInquiryBudget}>
                <FormattedMessage id="OrderPanel.customInquiryFormBudget" />
              </div>
              <div className={css.customInquiryPrice}>{formattedPrice}</div>
            </div>

            <div className={css.customInquiryBudgetFlex}>
              {flex_price && flex_price.length > 0 ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <mask
                      id="mask0_307_996"
                      maskUnits="userSpaceOnUse"
                      x="0"
                      y="0"
                      width="16"
                      height="16"
                    >
                      <rect
                        width="16"
                        height="16"
                        fill="#D9D9D9"
                      />
                    </mask>
                    <g mask="url(#mask0_307_996)">
                      <path
                        d="M6.36689 10.1L12.0169 4.45C12.1502 4.31667 12.3058 4.25 12.4836 4.25C12.6613 4.25 12.8169 4.31667 12.9502 4.45C13.0836 4.58333 13.1502 4.74167 13.1502 4.925C13.1502 5.10833 13.0836 5.26667 12.9502 5.4L6.83355 11.5333C6.70022 11.6667 6.54466 11.7333 6.36689 11.7333C6.18911 11.7333 6.03355 11.6667 5.90022 11.5333L3.03355 8.66667C2.90022 8.53333 2.83633 8.375 2.84189 8.19167C2.84744 8.00833 2.91689 7.85 3.05022 7.71667C3.18355 7.58333 3.34189 7.51667 3.52522 7.51667C3.70855 7.51667 3.86689 7.58333 4.00022 7.71667L6.36689 10.1Z"
                        fill="#1C1B1F"
                      />
                    </g>
                  </svg>
                  <FormattedMessage id="OrderPanel.customInquiryBudgetFlex" /></>
              ) : null}
            </div>
            {!isOwnListing && <>
              <FormattedMessage id="OrderPanel.customInquiryFormPriceDescription" />
              <PrimaryButton
                onClick={() => {
                  if (!isOwnListing) {
                    if (currentUser) {
                      setInquiryModalOpen(true);
                    } else {
                      const state = { from: `${location.pathname}${location.search}${location.hash}` };


                      // signup and return back to listingPage.
                      history.push(createResourceLocatorString('SignupPage', routes, {}, {}), state);
                    }
                  }
                }}
              >
                <FormattedMessage id="OrderPanel.customInquiryform" />
              </PrimaryButton>
            </>}
          </div>
        ) : !isKnownProcess ? (
          <p className={css.errorSidebar}>
            <FormattedMessage id="OrderPanel.unknownTransactionProcess" />
          </p>
        ) : null}
    </div>
  );
};

OrderPanel.defaultProps = {
  rootClassName: null,
  className: null,
  titleClassName: null,
  isOwnListing: false,
  authorLink: null,
  payoutDetailsWarning: null,
  titleDesktop: null,
  subTitle: null,
  monthlyTimeSlots: null,
  lineItems: null,
  fetchLineItemsError: null,
  setInquiryModalOpen: null,
};

OrderPanel.propTypes = {
  rootClassName: string,
  className: string,
  titleClassName: string,
  listing: oneOfType([propTypes.listing, propTypes.ownListing]),
  validListingTypes: arrayOf(
    shape({
      listingType: string.isRequired,
      transactionType: shape({
        process: string.isRequired,
        alias: string.isRequired,
        unitType: string.isRequired,
      }).isRequired,
    })
  ).isRequired,
  isOwnListing: bool,
  author: oneOfType([propTypes.user, propTypes.currentUser]).isRequired,
  authorLink: node,
  payoutDetailsWarning: node,
  onSubmit: func.isRequired,
  title: oneOfType([node, string]).isRequired,
  titleDesktop: node,
  subTitle: oneOfType([node, string]),
  onManageDisableScrolling: func.isRequired,

  onFetchTimeSlots: func.isRequired,
  monthlyTimeSlots: object,
  onFetchTransactionLineItems: func.isRequired,
  onContactUser: func,
  lineItems: array,
  fetchLineItemsInProgress: bool.isRequired,
  fetchLineItemsError: propTypes.error,
  marketplaceCurrency: string.isRequired,
  dayCountAvailableForBooking: number.isRequired,
  marketplaceName: string.isRequired,
  setInquiryModalOpen: func,

  // from withRouter
  history: shape({
    push: func.isRequired,
  }).isRequired,
  location: shape({
    search: string,
  }).isRequired,

  // from injectIntl
  intl: intlShape.isRequired,
};

export default compose(
  withRouter,
  injectIntl
)(OrderPanel);
