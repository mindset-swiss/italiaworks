import React from 'react';
import PropTypes from 'prop-types';
import css from './ReviewRatingCustom.module.css';

const ReviewRatingCustom = props => {
  const { rating, reviews } = props;

  return (
    <div className={css.wrapper}>
      <div className={css.rating}>
        <div>{rating.toFixed(1)}</div>
        <svg
          width="18"
          height="19"
          viewBox="0 0 18 19"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <mask
            id="mask0_307_981"
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="18"
            height="19"
          >
            <rect
              y="0.42572"
              width="18"
              height="18"
              fill="#D9D9D9"
            />
          </mask>
          <g mask="url(#mask0_307_981)">
            <path
              d="M8.99999 12.651L6.22499 14.7697C6.08749 14.8822 5.93749 14.9354 5.77499 14.9291C5.61249 14.9229 5.46874 14.876 5.34374 14.7885C5.21874 14.701 5.12186 14.5822 5.05311 14.4322C4.98436 14.2822 4.98124 14.1197 5.04374 13.9447L6.11249 10.476L3.39374 8.54473C3.24374 8.44473 3.14999 8.31348 3.11249 8.15098C3.07499 7.98848 3.08124 7.83848 3.13124 7.70098C3.18124 7.56348 3.26874 7.4416 3.39374 7.33535C3.51874 7.2291 3.66874 7.17598 3.84374 7.17598H7.19999L8.28749 3.57598C8.34999 3.40098 8.44686 3.2666 8.57811 3.17285C8.70936 3.0791 8.84999 3.03223 8.99999 3.03223C9.14999 3.03223 9.29061 3.0791 9.42186 3.17285C9.55311 3.2666 9.64999 3.40098 9.71249 3.57598L10.8 7.17598H14.1562C14.3312 7.17598 14.4812 7.2291 14.6062 7.33535C14.7312 7.4416 14.8187 7.56348 14.8687 7.70098C14.9187 7.83848 14.925 7.98848 14.8875 8.15098C14.85 8.31348 14.7562 8.44473 14.6062 8.54473L11.8875 10.476L12.9562 13.9447C13.0187 14.1197 13.0156 14.2822 12.9469 14.4322C12.8781 14.5822 12.7812 14.701 12.6562 14.7885C12.5312 14.876 12.3875 14.9229 12.225 14.9291C12.0625 14.9354 11.9125 14.8822 11.775 14.7697L8.99999 12.651Z"
              fill="#ED9F21"
            />
          </g>
        </svg>
      </div>
      <div className={css.counter}>({reviews})</div>
    </div>
  );
};

ReviewRatingCustom.defaultProps = {
  rating: null,
  reviews: null,
};

const { number } = PropTypes;

ReviewRatingCustom.propTypes = {
  rating: number,
  reviews: number,
};

export default ReviewRatingCustom;
