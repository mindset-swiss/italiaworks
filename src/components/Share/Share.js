import { FormattedMessage } from "react-intl";
import css from "./Share.module.css";
import { useLocation } from "react-router-dom/cjs/react-router-dom.min";

const Share = ({ title, description }) => {
  const location = useLocation();
  const url = `${window.location.origin}${location.pathname}${location.search}`;

  const options = [
    {
      name: 'Facebook',
      url: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      icon: (
        <svg
          width="21"
          height="21"
          viewBox="0 0 21 21"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M19.25 10.7664C19.25 5.90434 15.3325 1.96289 10.5 1.96289C5.66751 1.96289 1.75 5.90434 1.75 10.7664C1.75 15.1603 4.94973 18.8024 9.13281 19.4629V13.3111H6.91113V10.7664H9.13281V8.82685C9.13281 6.62048 10.4392 5.40175 12.4378 5.40175C13.3952 5.40175 14.3965 5.57369 14.3965 5.57369V7.74017H13.2932C12.2062 7.74017 11.8672 8.41883 11.8672 9.11505V10.7664H14.2939L13.906 13.3111H11.8672V19.4629C16.0503 18.8024 19.25 15.1605 19.25 10.7664Z"
            fill="#1F57C3"
          />
        </svg>
      ),
    },
    {
      name: 'Email',
      url: `mailto:?subject=${title}&body=${description} ${url}`,
      icon: (
        <svg
          width="21"
          height="21"
          viewBox="0 0 21 21"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M17.9891 2.92303C17.8624 2.83532 17.7147 2.78266 17.561 2.77037C17.4074 2.75807 17.2532 2.78659 17.1141 2.85303L2.23911 9.85303C2.0875 9.9252 1.95986 10.0395 1.87142 10.1822C1.78299 10.325 1.73749 10.4901 1.74036 10.658C1.74314 10.8258 1.79411 10.9893 1.8872 11.1289C1.98028 11.2685 2.11155 11.3784 2.26536 11.4455L6.99911 13.5193V19.3993L12.1091 15.7505L16.2741 17.5705C16.3835 17.6225 16.503 17.6494 16.6241 17.6493C16.785 17.6482 16.9424 17.6028 17.0791 17.518C17.1996 17.4451 17.3007 17.3442 17.3738 17.2238C17.4469 17.1035 17.4899 16.9673 17.4991 16.8268L18.3741 3.70178C18.3833 3.54969 18.3526 3.39783 18.2851 3.26125C18.2176 3.12466 18.1155 3.00807 17.9891 2.92303ZM15.8366 15.4705L11.2254 13.4493L13.9991 8.02428L7.30536 11.743L4.74161 10.6143L16.5279 5.06678L15.8366 15.4705Z"
            fill="#1F57C3"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className={css.share}>
      <div className={css.shareTitle}>
        <FormattedMessage id="ProfilePage.share" />
      </div>
      <ul className={css.shareList}>
        {options.map((option, key) => (
          <li>
            <a
              href={option.url}
              target="_blank"
              rel="nofollow"
              className={css.shareLink}
            >
              {option.icon}
              <span className={css.shareLabel}>{option.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Share;
