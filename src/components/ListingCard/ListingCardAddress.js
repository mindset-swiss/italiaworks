import css from "./ListingCard.module.css";

const ListingCardAddress = ({ text }) => {
  return (
    <div className={css.metaItem}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <mask
          id="mask0_280_1025"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="18"
          height="18"
        >
          <rect
            width="18"
            height="18"
            fill="#D9D9D9"
          />
        </mask>
        <g mask="url(#mask0_280_1025)">
          <path
            d="M9 9C9.4125 9 9.76563 8.85313 10.0594 8.55938C10.3531 8.26563 10.5 7.9125 10.5 7.5C10.5 7.0875 10.3531 6.73438 10.0594 6.44063C9.76563 6.14687 9.4125 6 9 6C8.5875 6 8.23438 6.14687 7.94063 6.44063C7.64687 6.73438 7.5 7.0875 7.5 7.5C7.5 7.9125 7.64687 8.26563 7.94063 8.55938C8.23438 8.85313 8.5875 9 9 9ZM9 14.5125C10.525 13.1125 11.6562 11.8406 12.3938 10.6969C13.1313 9.55312 13.5 8.5375 13.5 7.65C13.5 6.2875 13.0656 5.17188 12.1969 4.30312C11.3281 3.43438 10.2625 3 9 3C7.7375 3 6.67188 3.43438 5.80312 4.30312C4.93438 5.17188 4.5 6.2875 4.5 7.65C4.5 8.5375 4.86875 9.55312 5.60625 10.6969C6.34375 11.8406 7.475 13.1125 9 14.5125ZM9 16.5C6.9875 14.7875 5.48438 13.1969 4.49063 11.7281C3.49688 10.2594 3 8.9 3 7.65C3 5.775 3.60312 4.28125 4.80938 3.16875C6.01563 2.05625 7.4125 1.5 9 1.5C10.5875 1.5 11.9844 2.05625 13.1906 3.16875C14.3969 4.28125 15 5.775 15 7.65C15 8.9 14.5031 10.2594 13.5094 11.7281C12.5156 13.1969 11.0125 14.7875 9 16.5Z"
            fill="#4B4B4F"
          />
        </g>
      </svg>
      <div>{text}</div>
    </div>
  );
}

export default ListingCardAddress;
