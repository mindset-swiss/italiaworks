const ZeroBounceSDK = require('@zerobounce/zero-bounce-sdk');
const zeroBounce = new ZeroBounceSDK();

zeroBounce.init(process.env.ZEROBOUNCE_API_KEY);

module.exports = async (req, res) => {
  if (!req.body?.email) {
    return res.status(400).json({
      message: 'Email is required',
    });
  }

  let status = false;

  try {
    const credits = await zeroBounce.getCredits();

    if (credits?.Credits) {
      const response = await zeroBounce.validateEmail(req.body.email);
      
      status = response.status !== 'valid';
    }
  } catch (err) {
    console.error(err);
  }

  res.status(200).send(status);
};