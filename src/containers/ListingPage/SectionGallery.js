import React from 'react';
import ListingImageGallery from './ListingImageGallery/ListingImageGallery';

import css from './ListingPage.module.css';

const SectionGallery = props => {
  const { listing, variantPrefix } = props;
  const images = listing.images;

  const imageVariants = ['scaled-small', 'scaled-medium', 'scaled-large', 'scaled-xlarge'];
  const thumbnailVariants = [variantPrefix, `${variantPrefix}-2x`, `${variantPrefix}-4x`];
  return (
    <>
      {images && Array.isArray(images) && images.length > 0 ? (
        <section className={css.productGallery} data-testid="carousel">
          <ListingImageGallery
            images={images}
            imageVariants={imageVariants}
            thumbnailVariants={thumbnailVariants}
          />
        </section>
      ) : null}
    </>
  );
};

export default SectionGallery;
